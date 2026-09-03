import {
	type Consumable,
	ConsumableRepository,
	type Goal,
	GoalRepository,
	getDb,
	type IntakeEvent,
	IntakeEventRepository,
	IntakeStreamRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import {
	type DisplayUnit,
	isDisplayUnitForDimension,
	type LocalMoment,
	localDayOf,
	localTimeOf,
	type ParsedMeasurement,
	parseMeasurement,
	resolveLocalMoment,
	shiftLocalDay,
	systemLocale,
} from "@bro/domain";
import type { ConstituentAmounts } from "@bro/domain/constituent-catalogue";
import {
	type ConsumableComposition,
	type ConsumableKind,
	externalConsumableSource,
	type IntakeContext,
	type SystemConsumable,
	sourceRefOf,
} from "@bro/domain/consumable";
import type { ExternalConsumable } from "@bro/domain/food-search";
import type { ConsumptionDerivedMeasurementMetricDefinition } from "@bro/domain/metric-registry";
import {
	formatMetricValue,
	goalStatus,
	intakeDayTotal,
	intakePeriodTotals,
	intakeTrailingDailyMean,
	metricDisplayUnit,
	type PortionSelection,
	type ResolvedGoalProgress,
	resolveGoalProgress,
	resolveMetricObservations,
	scaleComposition,
	scaleConstituents,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";
import { listSystemConsumables, resolveSystemConsumable } from "../content";
import { i18n } from "../i18n";
import { unitWords } from "../units/unit-words";
import { intakeMetrics, intakeTrackedDefaults } from "./intake-settings-store";

/** How many days of history the week totals on a day screen cover. */
const WEEK_DAYS = 7;
/** How far back the day snapshot reads: enough for the usual-range band. */
const WINDOW_DAYS = 90;
/** Rolling window an intake goal's "current level" is averaged over. */
const GOAL_MEAN_WINDOW_DAYS = 7;
/** Recent events read before de-duplication, and kept after it. */
const RECENTS_READ_LIMIT = 48;
const RECENTS_SHOWN = 8;
const OTHER_DAYS_SHOWN = 7;
/** Used when logging against a past day, where "now" would be misleading. */
const DEFAULT_PAST_TIME = "20:00";

export type IntakeOccurrence = LocalMoment;

export type PresentedIntakeEvent = {
	event: IntakeEvent;
	detail: string;
	contributions: string;
};

export type IntakeGoalProgress = ResolvedGoalProgress;

export type IntakeMetricSummary = {
	metric: ConsumptionDerivedMeasurementMetricDefinition;
	tracked: boolean;
	displayUnit: DisplayUnit;
	dayValue: number | null;
	dayFormatted: string | null;
	weekValue: number | null;
	weekFormatted: string | null;
	goals: IntakeGoalProgress[];
};

export type IntakeDaySnapshot = {
	localDay: string;
	defaultTime: string;
	enabledKinds: ConsumableKind[];
	events: PresentedIntakeEvent[];
	/** Every intake metric, tracked or not; the goals screen offers all of them. */
	metrics: IntakeMetricSummary[];
	/** The tracked metrics only, in catalogue order: the tab's total rows. */
	totals: IntakeMetricSummary[];
	recents: PresentedIntakeEvent[];
	recentLocalDays: string[];
};

export type IntakeLogSnapshot = {
	localDay: string;
	defaultTime: string;
	enabledKinds: ConsumableKind[];
	recents: PresentedIntakeEvent[];
	library: Consumable[];
	system: SystemConsumable[];
};

/** What is being logged: a catalogue item, a library row, or a search result. */
export type LogSource =
	| { type: "system"; key: string }
	| { type: "library"; id: string }
	| { type: "external"; consumable: ExternalConsumable };

export type FreeIntakeDraft = IntakeOccurrence & {
	kind: ConsumableKind;
	name: string;
	brand?: string | null;
	portionLabel: string | null;
	quantity: number;
	massKg?: number | null;
	volumeL?: number | null;
	/** Per portion, canonical units. */
	constituents: ConstituentAmounts;
	context?: IntakeContext | null;
};

export type IntakeEventEdit = IntakeOccurrence & {
	name: string;
	portionLabel: string | null;
	quantity: number;
	context?: IntakeContext | null;
	notes?: string | null;
};

function formatNumber(value: number, locale: string | undefined): string {
	try {
		return new Intl.NumberFormat(locale).format(value);
	} catch {
		return String(value);
	}
}

/**
 * Identity of a logged event for "recent" de-duplication: everything a repeat
 * would reproduce. Two events that differ in any amount are genuinely
 * different things to log again, even under the same name.
 */
function recentKey(event: IntakeEvent): string {
	return JSON.stringify([
		event.kind,
		event.sourceRef,
		event.consumableId,
		event.name,
		event.brand,
		event.portionLabel,
		event.quantity,
		event.massKg,
		event.volumeL,
		Object.entries(event.constituents).sort(([left], [right]) =>
			left.localeCompare(right),
		),
	]);
}

function uniqueRecents(events: readonly IntakeEvent[]): IntakeEvent[] {
	const seen = new Set<string>();
	return events.filter((event) => {
		const key = recentKey(event);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function parseMetricInput(
	metric: ConsumptionDerivedMeasurementMetricDefinition,
	displayUnit: DisplayUnit,
	input: string,
	locale: string | undefined,
): ParsedMeasurement {
	const { dimension } = metric;
	if (
		(dimension === "mass" ||
			dimension === "volume" ||
			dimension === "energy") &&
		isDisplayUnitForDimension(dimension, displayUnit)
	) {
		return parseMeasurement(input, dimension, displayUnit, locale);
	}
	throw new TypeError(`Unit ${displayUnit} does not measure ${dimension}.`);
}

function assertQuantity(quantity: number): void {
	if (!Number.isFinite(quantity) || quantity <= 0) {
		throw new RangeError(i18n.t("validation:intake.quantityPositive"));
	}
}

/**
 * One store for everything taken in. A day is one stream of events across
 * every kind; the totals are arithmetic over that stream for whichever
 * constituents the user tracks; logging anything — a catalogue drink, a
 * library recipe, a searched food, or a free entry — writes one event with
 * its composition snapshotted beside it.
 */
export class IntakeStore {
	private readonly events: IntakeEventRepository;
	private readonly consumables: ConsumableRepository;
	private readonly streams: IntakeStreamRepository;
	private readonly goals: GoalRepository;
	private readonly tracked: TrackedMetricsRepository;
	private readonly preferences: UnitPreferenceRepository;

	constructor(
		db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly locale: () => string | undefined = systemLocale,
	) {
		this.events = new IntakeEventRepository(db);
		this.consumables = new ConsumableRepository(db);
		this.streams = new IntakeStreamRepository(db);
		this.goals = new GoalRepository(db);
		this.tracked = new TrackedMetricsRepository(db);
		this.preferences = new UnitPreferenceRepository(db);
	}

	private today(): string {
		return localDayOf(this.now());
	}

	private defaultTime(localDay: string): string {
		return localDay === this.today()
			? localTimeOf(this.now().getTime())
			: DEFAULT_PAST_TIME;
	}

	async loadToday(): Promise<IntakeDaySnapshot> {
		return await this.loadDay(this.today());
	}

	async loadDay(localDay: string): Promise<IntakeDaySnapshot> {
		const windowFrom = shiftLocalDay(localDay, -(WINDOW_DAYS - 1));
		const [enabledKinds, goals] = await Promise.all([
			this.streams.listEnabledKinds(),
			this.goals.listAll(),
		]);
		// Goal progress is a rolling mean from the goal's start, so the window
		// stretches back to cover the earliest active goal where it must.
		const earliestGoalDay = goals
			.filter((goal) => goalStatus(goal) === "active")
			.map((goal) =>
				shiftLocalDay(
					localDayOf(new Date(goal.startedAt)),
					-(GOAL_MEAN_WINDOW_DAYS - 1),
				),
			)
			.sort()[0];
		const fromLocalDay =
			earliestGoalDay && earliestGoalDay < windowFrom
				? earliestGoalDay
				: windowFrom;
		const [windowEvents, recents, preferences, overlays] = await Promise.all([
			this.events.listBetween(fromLocalDay, localDay),
			this.events.listRecent(enabledKinds, RECENTS_READ_LIMIT),
			this.preferences.resolveLatestPerDimension(),
			this.tracked.listResolved(intakeTrackedDefaults()),
		]);
		const dayEvents = windowEvents.filter(
			(event) => event.localDay === localDay,
		);
		const metrics = this.metricSummaries(
			localDay,
			windowEvents,
			dayEvents,
			goals,
			new Map(overlays.map((overlay) => [overlay.metricSlug, overlay])),
			new Map(
				preferences.map((preference) => [
					preference.dimension,
					preference.unit,
				]),
			),
		);
		const enabled = new Set<ConsumableKind>(enabledKinds);
		// A stream that is off does not exist on the day: its events stay
		// stored and keep counting towards any total still tracked, but the
		// surface shows what a user who never opted in would see.
		const visible = (event: IntakeEvent) => enabled.has(event.kind);

		return {
			localDay,
			defaultTime: this.defaultTime(localDay),
			enabledKinds,
			metrics,
			totals: metrics.filter((summary) => summary.tracked),
			events: dayEvents
				.filter(visible)
				.map((event) => this.presentEvent(event, metrics)),
			recents: uniqueRecents(recents)
				.slice(0, RECENTS_SHOWN)
				.map((event) => this.presentEvent(event, metrics)),
			recentLocalDays: [
				...new Set(
					[...windowEvents]
						.reverse()
						.filter(visible)
						.map((event) => event.localDay)
						.filter((day) => day !== localDay),
				),
			].slice(0, OTHER_DAYS_SHOWN),
		};
	}

	/** What the log screen offers before a search: recents, the library, the catalogue. */
	async loadLog(): Promise<IntakeLogSnapshot> {
		const localDay = this.today();
		const enabledKinds = await this.streams.listEnabledKinds();
		const [recents, library, preferences, overlays] = await Promise.all([
			this.events.listRecent(enabledKinds, RECENTS_READ_LIMIT),
			this.consumables.listAll(),
			this.preferences.resolveLatestPerDimension(),
			this.tracked.listResolved(intakeTrackedDefaults()),
		]);
		const metrics = this.metricSummaries(
			localDay,
			[],
			[],
			[],
			new Map(overlays.map((overlay) => [overlay.metricSlug, overlay])),
			new Map(
				preferences.map((preference) => [
					preference.dimension,
					preference.unit,
				]),
			),
		);
		const enabled = new Set<ConsumableKind>(enabledKinds);
		return {
			localDay,
			defaultTime: this.defaultTime(localDay),
			enabledKinds,
			recents: uniqueRecents(recents)
				.slice(0, RECENTS_SHOWN)
				.map((event) => this.presentEvent(event, metrics)),
			library: library.filter((consumable) => enabled.has(consumable.kind)),
			system: listSystemConsumables().filter((consumable) =>
				enabled.has(consumable.kind),
			),
		};
	}

	/** Resolves a log source to the composition an event snapshots from. */
	async resolveSource(source: LogSource): Promise<{
		kind: ConsumableKind;
		name: string;
		brand: string | null;
		composition: ConsumableComposition;
		consumableId: string | null;
		sourceRef: string | null;
	}> {
		if (source.type === "system") {
			const system = resolveSystemConsumable(source.key);
			if (!system) {
				throw new TypeError(i18n.t("validation:intake.chooseItem"));
			}
			return {
				kind: system.kind,
				name: system.name,
				brand: null,
				composition: system,
				consumableId: null,
				sourceRef: sourceRefOf({ type: "system", key: system.key }),
			};
		}
		if (source.type === "library") {
			const consumable = await this.consumables.findById(source.id);
			if (!consumable) {
				throw new TypeError(i18n.t("validation:intake.consumableNotFound"));
			}
			return {
				kind: consumable.kind,
				name: consumable.name,
				brand: consumable.brand,
				composition: consumable,
				consumableId: consumable.id,
				sourceRef: sourceRefOf(consumable.source, consumable.id),
			};
		}
		// Logging a searched product saves it to the library first — one row per
		// product however often it is logged — so "my foods" survive a phone
		// change and repeat offline forever. The cache row stays where it was.
		const external = source.consumable;
		const providerSource = externalConsumableSource(external);
		const consumable =
			(await this.consumables.findBySource(providerSource)) ??
			(await this.consumables.create({
				kind: external.kind,
				name: external.name,
				brand: external.brand,
				barcode: external.barcode,
				basis: external.basis,
				constituents: external.constituents,
				portions: [...external.portions],
				defaultPortionId: external.defaultPortionId,
				recipe: null,
				source: providerSource,
			}));
		return {
			kind: consumable.kind,
			name: consumable.name,
			brand: consumable.brand,
			composition: consumable,
			consumableId: consumable.id,
			sourceRef: sourceRefOf(consumable.source, consumable.id),
		};
	}

	/** Logs one portion (or weight, or volume) of a consumable as one event. */
	async log(
		source: LogSource,
		selection: PortionSelection,
		occurrence: IntakeOccurrence,
		context: IntakeContext | null = null,
	): Promise<IntakeEvent> {
		const resolved = await this.resolveSource(source);
		await this.assertStreamEnabled(resolved.kind);
		const scaled = scaleComposition(resolved.composition, selection);
		return await this.events.create({
			kind: resolved.kind,
			consumableId: resolved.consumableId,
			sourceRef: resolved.sourceRef,
			name: resolved.name,
			brand: resolved.brand,
			portionLabel: scaled.portionLabel,
			quantity: scaled.quantity,
			massKg: scaled.massKg,
			volumeL: scaled.volumeL,
			constituents: scaled.constituents,
			context,
			notes: null,
			...resolveLocalMoment(occurrence),
		});
	}

	/** "Something else": a complete event with no library row behind it. */
	async logFree(draft: FreeIntakeDraft): Promise<IntakeEvent> {
		assertQuantity(draft.quantity);
		await this.assertStreamEnabled(draft.kind);
		if (!draft.name.trim()) {
			throw new TypeError(i18n.t("validation:intake.nameRequired"));
		}
		if (
			Object.keys(draft.constituents).length === 0 &&
			draft.massKg == null &&
			draft.volumeL == null
		) {
			throw new RangeError(i18n.t("validation:intake.needsOneValue"));
		}
		return await this.events.create({
			kind: draft.kind,
			consumableId: null,
			sourceRef: null,
			name: draft.name,
			brand: draft.brand ?? null,
			portionLabel: draft.portionLabel,
			quantity: draft.quantity,
			massKg: draft.massKg == null ? null : draft.massKg * draft.quantity,
			volumeL: draft.volumeL == null ? null : draft.volumeL * draft.quantity,
			constituents: scaleConstituents(draft.constituents, draft.quantity),
			context: draft.context ?? null,
			notes: null,
			...resolveLocalMoment(draft),
		});
	}

	async repeatEvent(
		id: string,
		occurrence: IntakeOccurrence = {
			localDay: this.today(),
			time: localTimeOf(this.now().getTime()),
		},
	): Promise<IntakeEvent> {
		const event = await this.events.findById(id);
		if (!event) {
			throw new TypeError(i18n.t("validation:intake.recentNotFound"));
		}
		await this.assertStreamEnabled(event.kind);
		const {
			id: _id,
			createdAt: _createdAt,
			updatedAt: _updatedAt,
			...snapshot
		} = event;
		return await this.events.create({
			...snapshot,
			...resolveLocalMoment(occurrence),
		});
	}

	/**
	 * Corrects an event in place. Quantity is the only lever on the snapshotted
	 * amounts: they were copied when logged and are rescaled proportionally
	 * rather than recomputed, so a later catalogue change cannot rewrite history.
	 */
	async updateEvent(id: string, edit: IntakeEventEdit): Promise<IntakeEvent> {
		const event = await this.events.findById(id);
		if (!event) {
			throw new TypeError(i18n.t("validation:intake.eventNotFound"));
		}
		assertQuantity(edit.quantity);
		const scale = edit.quantity / event.quantity;
		const updated = await this.events.update(id, {
			consumableId: event.consumableId,
			sourceRef: event.sourceRef,
			name: edit.name,
			brand: event.brand,
			portionLabel: edit.portionLabel,
			quantity: edit.quantity,
			massKg: event.massKg === null ? null : event.massKg * scale,
			volumeL: event.volumeL === null ? null : event.volumeL * scale,
			constituents: scaleConstituents(event.constituents, scale),
			context: edit.context === undefined ? event.context : edit.context,
			notes: edit.notes === undefined ? event.notes : edit.notes,
			...resolveLocalMoment(edit),
		});
		if (!updated) {
			throw new TypeError(i18n.t("validation:intake.eventNotFound"));
		}
		return updated;
	}

	async deleteEvent(id: string): Promise<void> {
		if (!(await this.events.delete(id))) {
			throw new TypeError(i18n.t("validation:intake.eventNotFound"));
		}
	}

	/**
	 * Opens a goal against an intake metric. The target is parsed in the unit
	 * the user is currently reading and stored canonically, so changing unit
	 * preference later does not move the goalposts.
	 */
	async createGoal(
		metricSlug: string,
		targetInput: string,
		targetDate: string | null,
	): Promise<Goal> {
		const metric = this.resolveIntakeMetric(metricSlug);
		const [events, goals, preferences] = await Promise.all([
			this.events.listAll(),
			this.goals.listAll(),
			this.preferences.resolveLatestPerDimension(),
		]);
		const displayUnit = metricDisplayUnit(
			metric,
			new Map(
				preferences.map((preference) => [
					preference.dimension,
					preference.unit,
				]),
			),
			this.locale(),
		) as DisplayUnit;
		const parsed = parseMetricInput(
			metric,
			displayUnit,
			targetInput,
			this.locale(),
		);
		if (!parsed.ok) throw new TypeError(parsed.error);
		const latest = resolveMetricObservations(metric.slug, [], [], events).at(
			-1,
		);
		if (!latest) {
			throw new TypeError(i18n.t("validation:intake.logBeforeGoal"));
		}
		if (parsed.canonicalValue === latest.value) {
			throw new RangeError(i18n.t("validation:intake.targetSameAsLatest"));
		}
		if (
			goals.some(
				(goal) =>
					goal.metricSlug === metric.slug && goalStatus(goal) === "active",
			)
		) {
			throw new TypeError(i18n.t("validation:intake.activeGoalExists"));
		}
		return await this.goals.create({
			metricSlug: metric.slug,
			direction: parsed.canonicalValue > latest.value ? "increase" : "decrease",
			targetValue: parsed.canonicalValue,
			targetDate,
			startedAt: this.now().getTime(),
		});
	}

	async achieveGoal(id: string): Promise<Goal | null> {
		return await this.goals.achieve(id);
	}

	async abandonGoal(id: string): Promise<Goal | null> {
		return await this.goals.abandon(id);
	}

	private async assertStreamEnabled(kind: ConsumableKind): Promise<void> {
		if (!(await this.streams.isEnabled(kind))) {
			throw new TypeError(
				i18n.t("validation:intake.streamOff", {
					stream: i18n.t(`intake:streams.${kind}`),
				}),
			);
		}
	}

	private resolveIntakeMetric(
		metricSlug: string,
	): ConsumptionDerivedMeasurementMetricDefinition {
		const metric = intakeMetrics().find(
			(candidate) => candidate.slug === metricSlug,
		);
		if (!metric) {
			throw new TypeError(
				i18n.t("validation:intake.unknownMetric", { slug: metricSlug }),
			);
		}
		return metric;
	}

	private metricSummaries(
		localDay: string,
		windowEvents: readonly IntakeEvent[],
		dayEvents: readonly IntakeEvent[],
		goals: readonly Goal[],
		overlayBySlug: ReadonlyMap<string, { enabled: boolean }>,
		preferenceByDimension: ReadonlyMap<string, string>,
	): IntakeMetricSummary[] {
		const locale = this.locale();
		const weekFrom = shiftLocalDay(localDay, -(WEEK_DAYS - 1));
		return intakeMetrics().map((metric) => {
			const displayUnit = metricDisplayUnit(
				metric,
				preferenceByDimension,
				locale,
			) as DisplayUnit;
			const format = (value: number) =>
				formatMetricValue(metric, value, displayUnit, locale, unitWords());
			const dayValue = intakeDayTotal(
				metric.constituentCode,
				localDay,
				dayEvents,
			).value;
			const week = intakePeriodTotals(
				metric.constituentCode,
				weekFrom,
				localDay,
				windowEvents,
			);
			const weekValue = week.loggedDays === 0 ? null : week.sum;
			const series = resolveMetricObservations(
				metric.slug,
				[],
				[],
				windowEvents,
			);
			return {
				metric,
				tracked: overlayBySlug.get(metric.slug)?.enabled ?? false,
				displayUnit,
				dayValue,
				dayFormatted: dayValue === null ? null : format(dayValue),
				weekValue,
				weekFormatted: weekValue === null ? null : format(weekValue),
				goals: goals
					.filter((goal) => goal.metricSlug === metric.slug)
					.map((goal) =>
						resolveGoalProgress({
							goal,
							series,
							startValue:
								series.length === 0
									? null
									: intakeTrailingDailyMean(
											metric.constituentCode,
											localDayOf(new Date(goal.startedAt)),
											GOAL_MEAN_WINDOW_DAYS,
											windowEvents,
										),
							currentValue:
								series.length === 0
									? null
									: intakeTrailingDailyMean(
											metric.constituentCode,
											this.today(),
											GOAL_MEAN_WINDOW_DAYS,
											windowEvents,
										),
							format,
						}),
					),
			};
		});
	}

	/**
	 * One event as a row: what was had, and what it added to the totals the
	 * user tracks. Only positive amounts are named; a zero is a fact about the
	 * item, not something worth a word on the row.
	 */
	private presentEvent(
		event: IntakeEvent,
		metrics: readonly IntakeMetricSummary[],
	): PresentedIntakeEvent {
		const locale = this.locale();
		const contributions = metrics.flatMap(
			({ metric, tracked, displayUnit }) => {
				if (!tracked) return [];
				const value = event.constituents[metric.constituentCode];
				return value === undefined || value <= 0
					? []
					: [
							formatMetricValue(
								metric,
								value,
								displayUnit,
								locale,
								unitWords(),
							),
						];
			},
		);
		return {
			event,
			detail: i18n.t("intake:event.detail", {
				quantity: formatNumber(event.quantity, locale),
				portion: event.portionLabel ?? i18n.t("intake:event.defaultPortion"),
				time: localTimeOf(event.occurredAt),
			}),
			contributions: contributions.join(" · "),
		};
	}
}

export function createIntakeStore(): IntakeStore {
	return new IntakeStore(getDb());
}
