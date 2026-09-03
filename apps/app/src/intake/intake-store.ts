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
	fromCanonical,
	isDisplayUnitForDimension,
	type LocalMoment,
	localDayOf,
	localTimeOf,
	type ParsedMeasurement,
	parseMeasurement,
	resolveLocalMoment,
	shiftLocalDay,
	systemLocale,
	toCanonical,
} from "@bro/domain";
import {
	CONSTITUENT_CATALOGUE,
	type ConstituentAmounts,
	type ConstituentCategory,
} from "@bro/domain/constituent-catalogue";
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
	formatLocalDayDate,
	formatLocalDayLabel,
	formatMetricValue,
	goalStatus,
	INTAKE_BASELINE_MIN_LOGGED_DAYS,
	INTAKE_BASELINE_WINDOW_DAYS,
	intakeBaseline,
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
const WINDOW_DAYS = INTAKE_BASELINE_WINDOW_DAYS;
/** Rolling window an intake goal's "current level" is averaged over. */
const GOAL_MEAN_WINDOW_DAYS = 7;
/** Recent events read before de-duplication, and kept after it. */
const RECENTS_READ_LIMIT = 48;
const RECENTS_SHOWN = 8;
/** Used when logging against a past day, where "now" would be misleading. */
const DEFAULT_PAST_TIME = "20:00";
/**
 * Two of the same thing this close together are one sitting — a second pint,
 * a second biscuit — and read as one row rather than a duplicate.
 */
const SITTING_MS = 90 * 60_000;
const MINUTES_PER_DAY = 24 * 60;
/** Totals that are zero most days get their read in two modes; see below. */
const LOAD_CATEGORIES: ReadonlySet<ConstituentCategory> = new Set([
	"stimulant",
	"alcohol",
]);
/** Codes with their own word for a day that carries them. */
type BimodalDayWord = "ethanol" | "nicotine" | "caffeine" | "default";
const BIMODAL_DAY_WORDS: readonly BimodalDayWord[] = [
	"ethanol",
	"nicotine",
	"caffeine",
];

function bimodalDayWord(code: string): BimodalDayWord {
	return (BIMODAL_DAY_WORDS as readonly string[]).includes(code)
		? (code as BimodalDayWord)
		: "default";
}

export type IntakeOccurrence = LocalMoment;

export type PresentedIntakeEvent = {
	event: IntakeEvent;
	detail: string;
	contributions: string;
};

/**
 * One row of the day's stream: identical things had at the same sitting
 * grouped into it, so a second pint is "2 × pint" and never a duplicate row.
 */
export type PresentedIntakeEntry = {
	key: string;
	time: string;
	name: string;
	/** Quantity and portion, and the brand where there is one. */
	meta: string | null;
	/** What the row added to the tracked totals, or empty. */
	value: string;
	events: PresentedIntakeEvent[];
	accessibilityLabel: string;
};

export type IntakeGoalProgress = ResolvedGoalProgress;

export type IntakeGaugeRange = { min: number; max: number };

/** What the compact gauge draws once a total has a usual range. */
export type IntakeTotalGauge = {
	rail: IntakeGaugeRange;
	railLabels: { min: string; max: string };
	band: IntakeGaugeRange;
};

/** The ink a total draws in: body for what is eaten and drunk, load for stimulants and alcohol. */
export type IntakeDomain = "body" | "load";

export type IntakeMetricSummary = {
	metric: ConsumptionDerivedMeasurementMetricDefinition;
	tracked: boolean;
	displayUnit: DisplayUnit;
	domain: IntakeDomain;
	dayValue: number | null;
	dayFormatted: string | null;
	/** The day total with its unit split off, so the unit can sit in caption type. */
	dayValueParts: { value: string; unit: string | null } | null;
	/** "so far today", or for a stimulant when the last one was. */
	meta: string | null;
	gauge: IntakeTotalGauge | null;
	/** One line stating the usual band as fact, or null while there is none. */
	read: string | null;
	weekValue: number | null;
	weekFormatted: string | null;
	goals: IntakeGoalProgress[];
};

export type IntakeDaySnapshot = {
	localDay: string;
	/** "Today", "Yesterday", or the weekday and date. */
	dayLabel: string;
	/** The weekday and date when the label above is relative, else null. */
	dayDate: string | null;
	isToday: boolean;
	defaultTime: string;
	enabledKinds: ConsumableKind[];
	/** Every visible event in time order; each is editable on its own. */
	events: PresentedIntakeEvent[];
	/** The same events as rows, repeats at one sitting grouped. */
	entries: PresentedIntakeEntry[];
	/** Every intake metric, tracked or not; the goals screen offers all of them. */
	metrics: IntakeMetricSummary[];
	/** The tracked metrics only, in catalogue order: the tab's gauges. */
	totals: IntakeMetricSummary[];
};

export type IntakeLogSnapshot = {
	/** The day being logged against: today unless the screen was opened for another. */
	localDay: string;
	today: string;
	defaultTime: string;
	enabledKinds: ConsumableKind[];
	/** De-duplicated and ranked by how close their time of day is to now. */
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

/** "489 kcal" → 489 and kcal; a reading with no unit word stays whole. */
function splitUnit(formatted: string): { value: string; unit: string | null } {
	const match = /^(.*\d\S*)\s+(\D+)$/.exec(formatted);
	return match?.[1] && match[2]
		? { value: match[1], unit: match[2] }
		: { value: formatted, unit: null };
}

/** Round-number steps a rail may end on, per decade: 250 rather than 207. */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceCeiling(value: number): number {
	if (!(value > 0)) return 0;
	const magnitude = 10 ** Math.floor(Math.log10(value));
	for (const step of NICE_STEPS) {
		const candidate = step * magnitude;
		if (candidate >= value) return candidate;
	}
	return 10 * magnitude;
}

/**
 * Conversions between a metric's canonical unit and the one being read, so a
 * rail can end on a round number of the unit on screen rather than of kilograms.
 */
function displayScale(
	metric: ConsumptionDerivedMeasurementMetricDefinition,
	displayUnit: DisplayUnit,
): {
	toDisplay: (value: number) => number;
	fromDisplay: (value: number) => number;
} {
	const { dimension } = metric;
	if (
		(dimension === "mass" ||
			dimension === "volume" ||
			dimension === "energy") &&
		isDisplayUnitForDimension(dimension, displayUnit)
	) {
		return {
			toDisplay: (value) => fromCanonical(value, dimension, displayUnit),
			fromDisplay: (value) => toCanonical(value, dimension, displayUnit),
		};
	}
	return { toDisplay: (value) => value, fromDisplay: (value) => value };
}

function minutesOfDay(time: string): number {
	const [hours = 0, minutes = 0] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

/** Distance around the clock, so 23:50 and 00:10 are twenty minutes apart. */
function timeOfDayDistance(left: number, right: number): number {
	const difference = Math.abs(left - right) % MINUTES_PER_DAY;
	return Math.min(difference, MINUTES_PER_DAY - difference);
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

/**
 * Identity of an event for grouping within a day: the same thing in the same
 * portion, whatever the quantity. Amounts are compared per unit so "2 × pint"
 * and "1 × pint" fall in together.
 */
function sittingKey(event: IntakeEvent): string {
	return JSON.stringify([
		event.kind,
		event.name,
		event.brand,
		event.portionLabel,
		Object.entries(event.constituents)
			.map(([code, amount]) => [
				code,
				Number((amount / event.quantity).toPrecision(9)),
			])
			.sort(([left], [right]) => String(left).localeCompare(String(right))),
	]);
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

const categoryByCode = new Map(
	CONSTITUENT_CATALOGUE.map((constituent) => [
		constituent.code,
		constituent.category,
	]),
);

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
		const [windowEvents, preferences, overlays] = await Promise.all([
			this.events.listBetween(fromLocalDay, localDay),
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
		const visibleDayEvents = dayEvents.filter(visible);
		const today = this.today();
		const locale = this.locale();
		const dayLabel = formatLocalDayLabel(localDay, today, locale);
		const dayDate = formatLocalDayDate(localDay, today, locale);

		return {
			localDay,
			dayLabel,
			dayDate: dayLabel === dayDate ? null : dayDate,
			isToday: localDay === today,
			defaultTime: this.defaultTime(localDay),
			enabledKinds,
			metrics,
			totals: metrics.filter((summary) => summary.tracked),
			events: visibleDayEvents.map((event) =>
				this.presentEvent(event, metrics),
			),
			entries: this.presentEntries(visibleDayEvents, metrics),
		};
	}

	/**
	 * What the log screen offers before a search: recents, the library, the
	 * catalogue. Recents come ranked by time of day — at half six the evening
	 * things come first — because a man logs the same forty things and most of
	 * them belong to a part of the day.
	 */
	async loadLog(localDay: string = this.today()): Promise<IntakeLogSnapshot> {
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
		const nowMinutes = minutesOfDay(localTimeOf(this.now().getTime()));
		return {
			localDay,
			today: this.today(),
			defaultTime: this.defaultTime(localDay),
			enabledKinds,
			recents: uniqueRecents(recents)
				.map((event, index) => ({
					event,
					index,
					distance: timeOfDayDistance(
						minutesOfDay(localTimeOf(event.occurredAt)),
						nowMinutes,
					),
				}))
				.sort(
					(left, right) =>
						left.distance - right.distance || left.index - right.index,
				)
				.slice(0, RECENTS_SHOWN)
				.map(({ event }) => this.presentEvent(event, metrics)),
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

	/**
	 * Logs a recent again at its remembered portion, or at another quantity of
	 * that portion: the snapshot rescales proportionally, so a second pint is
	 * the same pint.
	 */
	async repeatEvent(
		id: string,
		occurrence: IntakeOccurrence = {
			localDay: this.today(),
			time: localTimeOf(this.now().getTime()),
		},
		quantity?: number,
	): Promise<IntakeEvent> {
		const event = await this.events.findById(id);
		if (!event) {
			throw new TypeError(i18n.t("validation:intake.recentNotFound"));
		}
		await this.assertStreamEnabled(event.kind);
		if (quantity !== undefined) assertQuantity(quantity);
		const scale = quantity === undefined ? 1 : quantity / event.quantity;
		const {
			id: _id,
			createdAt: _createdAt,
			updatedAt: _updatedAt,
			...snapshot
		} = event;
		return await this.events.create({
			...snapshot,
			quantity: event.quantity * scale,
			massKg: event.massKg === null ? null : event.massKg * scale,
			volumeL: event.volumeL === null ? null : event.volumeL * scale,
			constituents: scaleConstituents(event.constituents, scale),
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
		const isToday = localDay === this.today();
		return intakeMetrics().map((metric) => {
			const code = metric.constituentCode;
			const category = categoryByCode.get(code) ?? "other";
			const displayUnit = metricDisplayUnit(
				metric,
				preferenceByDimension,
				locale,
			) as DisplayUnit;
			const format = (value: number) =>
				formatMetricValue(metric, value, displayUnit, locale, unitWords());
			const dayValue = intakeDayTotal(code, localDay, dayEvents).value;
			const week = intakePeriodTotals(code, weekFrom, localDay, windowEvents);
			const weekValue = week.loggedDays === 0 ? null : week.sum;
			const series = resolveMetricObservations(
				metric.slug,
				[],
				[],
				windowEvents,
			);
			const { gauge, read } = this.usualRange(
				metric,
				displayUnit,
				localDay,
				windowEvents,
				dayValue,
				format,
			);
			const lastToday =
				category === "stimulant"
					? [...dayEvents]
							.reverse()
							.find((event) => (event.constituents[code] ?? 0) > 0)
					: undefined;
			return {
				metric,
				tracked: overlayBySlug.get(metric.slug)?.enabled ?? false,
				displayUnit,
				domain: LOAD_CATEGORIES.has(category) ? "load" : "body",
				dayValue,
				dayFormatted: dayValue === null ? null : format(dayValue),
				dayValueParts: dayValue === null ? null : splitUnit(format(dayValue)),
				meta: lastToday
					? i18n.t("intake:tab.lastAt", {
							time: localTimeOf(lastToday.occurredAt),
						})
					: isToday
						? i18n.t("intake:tab.soFarToday")
						: null,
				gauge,
				read,
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
											code,
											localDayOf(new Date(goal.startedAt)),
											GOAL_MEAN_WINDOW_DAYS,
											windowEvents,
										),
							currentValue:
								series.length === 0
									? null
									: intakeTrailingDailyMean(
											code,
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
	 * The day's total against the user's own usual: the middle half of the
	 * last ninety logged days as a band, stated in one plain sentence. Where a
	 * total is zero on most logged days — alcohol, cigarettes — averaging
	 * across the zeros would describe nobody, so the read names both modes and
	 * the band is drawn from the days that carried it. Nothing here is a
	 * target, a budget, or a remaining amount.
	 */
	private usualRange(
		metric: ConsumptionDerivedMeasurementMetricDefinition,
		displayUnit: DisplayUnit,
		localDay: string,
		windowEvents: readonly IntakeEvent[],
		dayValue: number | null,
		format: (value: number) => string,
	): { gauge: IntakeTotalGauge | null; read: string | null } {
		const code = metric.constituentCode;
		const windowFrom = shiftLocalDay(localDay, -(WINDOW_DAYS - 1));
		const inWindow = windowEvents.filter(
			(event) => event.localDay >= windowFrom && event.localDay <= localDay,
		);
		const loggedDays = new Set(inWindow.map((event) => event.localDay)).size;
		const carrying = inWindow.filter(
			(event) => (event.constituents[code] ?? 0) > 0,
		);
		const carryingDays = new Set(carrying.map((event) => event.localDay)).size;
		const bimodal =
			loggedDays >= INTAKE_BASELINE_MIN_LOGGED_DAYS &&
			carryingDays * 2 <= loggedDays;
		const band = intakeBaseline(
			code,
			bimodal ? carrying : inWindow,
			localDay,
		).usualRange;
		const ends = band
			? {
					min: splitUnit(format(band.min)).value,
					max: splitUnit(format(band.max)).value,
				}
			: null;
		const read = bimodal
			? ends
				? i18n.t("intake:read.bimodal", {
						days: i18n.t(`intake:read.days.${bimodalDayWord(code)}`),
						...ends,
					})
				: i18n.t("intake:read.bimodalNone")
			: ends
				? i18n.t("intake:read.usual", ends)
				: null;
		if (!band || dayValue === null) return { gauge: null, read };
		// The rail runs from nothing to a round number a little past the most
		// the day or the band holds, in the unit being read, so the marker and
		// the band always draw inside it and the end reads "3,000", not "2,904".
		const { toDisplay, fromDisplay } = displayScale(metric, displayUnit);
		const railEnd = niceCeiling(toDisplay(Math.max(band.max, dayValue)) * 1.15);
		const locale = this.locale();
		return {
			gauge: {
				rail: { min: 0, max: fromDisplay(railEnd) },
				railLabels: {
					min: formatNumber(0, locale),
					max: formatNumber(railEnd, locale),
				},
				band,
			},
			read,
		};
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
		return {
			event,
			detail: i18n.t("intake:event.detail", {
				quantity: formatNumber(event.quantity, locale),
				portion: event.portionLabel ?? i18n.t("intake:event.defaultPortion"),
				time: localTimeOf(event.occurredAt),
			}),
			contributions: this.contributions(event.constituents, metrics),
		};
	}

	private contributions(
		constituents: ConstituentAmounts,
		metrics: readonly IntakeMetricSummary[],
	): string {
		const locale = this.locale();
		return metrics
			.flatMap(({ metric, tracked, displayUnit }) => {
				if (!tracked) return [];
				const value = constituents[metric.constituentCode];
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
			})
			.join(" · ");
	}

	/** The day's events as rows, the same thing at one sitting grouped. */
	private presentEntries(
		dayEvents: readonly IntakeEvent[],
		metrics: readonly IntakeMetricSummary[],
	): PresentedIntakeEntry[] {
		const locale = this.locale();
		const groups: { key: string; first: IntakeEvent; events: IntakeEvent[] }[] =
			[];
		for (const event of [...dayEvents].sort(
			(left, right) =>
				left.occurredAt - right.occurredAt || left.createdAt - right.createdAt,
		)) {
			const key = sittingKey(event);
			const open = groups.find(
				(group) =>
					group.key === key &&
					event.occurredAt - group.first.occurredAt <= SITTING_MS,
			);
			if (open) open.events.push(event);
			else groups.push({ key, first: event, events: [event] });
		}
		return groups.map(({ first, events }) => {
			const quantity = events.reduce((sum, event) => sum + event.quantity, 0);
			const constituents: Record<string, number> = {};
			for (const event of events) {
				for (const [code, amount] of Object.entries(event.constituents)) {
					constituents[code] = (constituents[code] ?? 0) + amount;
				}
			}
			const portion =
				first.portionLabel === null && quantity === 1
					? null
					: i18n.t("intake:entry.portion", {
							quantity: formatNumber(quantity, locale),
							portion:
								first.portionLabel ?? i18n.t("intake:event.defaultPortion"),
						});
			const meta = [portion, first.brand].filter(Boolean).join(" · ") || null;
			const time = localTimeOf(first.occurredAt);
			const value = this.contributions(constituents, metrics);
			return {
				key: first.id,
				time,
				name: first.name,
				meta,
				value,
				events: events.map((event) => this.presentEvent(event, metrics)),
				accessibilityLabel: i18n.t("intake:entry.rowA11y", {
					name: first.name,
					detail: [meta, value].filter(Boolean).join(", ") || time,
					time,
				}),
			};
		});
	}
}

export function createIntakeStore(): IntakeStore {
	return new IntakeStore(getDb());
}
