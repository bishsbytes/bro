import {
	type ConsumptionEntry,
	type ConsumptionEntryKind,
	ConsumptionEntryRepository,
	type CreateCustomConsumableComponent,
	type CustomConsumable,
	CustomConsumableRepository,
	type CustomConsumableServing,
	type Goal,
	GoalRepository,
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
import {
	type ConsumptionDerivedMeasurementMetricDefinition,
	type ConsumptionDerivedMeasurementSlug,
	listConsumptionDerivedMeasurements,
	resolveMetric,
} from "@bro/domain/metric-registry";
import {
	consumptionMetricDayTotal,
	consumptionMetricTrailingDailyMean,
	formatMetricValue,
	goalStatus,
	metricDisplayUnit,
	type ResolvedGoalProgress,
	resolveGoalProgress,
	resolveMetricObservations,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";

/** How many days of history the week totals on a day screen cover. */
const WEEK_DAYS = 7;
/** Rolling window a consumption goal's "current level" is averaged over. */
const GOAL_MEAN_WINDOW_DAYS = 7;
/** Recent entries read before de-duplication, and kept after it. */
const RECENTS_READ_LIMIT = 24;
const RECENTS_SHOWN = 8;
const OTHER_DAYS_SHOWN = 7;
/** Used when logging against a past day, where "now" would be misleading. */
const DEFAULT_PAST_TIME = "20:00";

export type ConsumptionOccurrence = LocalMoment;

export type PresentedConsumptionEntry = {
	entry: ConsumptionEntry;
	detail: string;
	contributions: string;
};

export type ConsumptionGoalProgress = ResolvedGoalProgress;

export type ConsumptionEntryEdit = ConsumptionOccurrence & {
	label: string;
	servingLabel: string | null;
	quantity: number;
};

export type ConsumptionMetricSummary<
	Metric extends
		ConsumptionDerivedMeasurementMetricDefinition = ConsumptionDerivedMeasurementMetricDefinition,
> = {
	metric: Metric;
	tracked: boolean;
	displayUnit: DisplayUnit;
	dayValue: number | null;
	dayFormatted: string | null;
	weekValue: number | null;
	weekFormatted: string | null;
	goals: ConsumptionGoalProgress[];
};

export type ConsumptionMetricSetting<
	Slug extends ConsumptionDerivedMeasurementSlug,
> = {
	metricSlug: Slug;
	label: string;
	tracked: boolean;
};

/** The day's shared shape; each store adds its own catalogue or custom list. */
export type ConsumptionDaySnapshot<
	Metric extends ConsumptionDerivedMeasurementMetricDefinition,
> = {
	localDay: string;
	defaultTime: string;
	weekFromLocalDay: string;
	entries: PresentedConsumptionEntry[];
	metrics: ConsumptionMetricSummary<Metric>[];
	recents: PresentedConsumptionEntry[];
	recentLocalDays: string[];
};

export type CustomConsumableDraft = {
	id?: string;
	label: string;
	brand: string | null;
	isRecipe: boolean;
	servings: CustomConsumableServing[];
};

export function assertFiniteNonNegative(
	value: number | null,
	label: string,
): void {
	if (value !== null && (!Number.isFinite(value) || value < 0)) {
		throw new RangeError(`${label} must be empty or a non-negative number.`);
	}
}

export function scaleNullable(
	value: number | null | undefined,
	factor: number,
): number | null {
	return value == null ? null : value * factor;
}

/**
 * Identity of a logged entry for "recent" de-duplication: everything a repeat
 * would reproduce. Two entries that differ in any canonical quantity are
 * genuinely different things to log again, even under the same label.
 */
function recentKey(entry: ConsumptionEntry): string {
	return JSON.stringify([
		entry.catalogueRef,
		entry.consumableRef,
		entry.label,
		entry.servingLabel,
		entry.quantity,
		entry.volumeL,
		entry.ethanolKg,
		entry.caffeineKg,
		entry.energyKcal,
		entry.proteinG,
		entry.carbsG,
		entry.fatG,
	]);
}

function uniqueRecents(
	entries: readonly ConsumptionEntry[],
): ConsumptionEntry[] {
	const seen = new Set<string>();
	return entries.filter((entry) => {
		const key = recentKey(entry);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function parseMetricInput(
	metric: ConsumptionDerivedMeasurementMetricDefinition,
	displayUnit: DisplayUnit,
	input: string,
	locale: string | undefined,
): ParsedMeasurement {
	const { dimension } = metric;
	if (
		(dimension === "mass" ||
			dimension === "length" ||
			dimension === "fraction" ||
			dimension === "volume" ||
			dimension === "energy") &&
		isDisplayUnitForDimension(dimension, displayUnit)
	) {
		return parseMeasurement(input, dimension, displayUnit, locale);
	}
	throw new TypeError(`Unit ${displayUnit} does not measure ${dimension}.`);
}

/**
 * Everything the food and drink stores do identically: reading a day's entries,
 * projecting them into per-metric day and week totals, tracking settings, goals,
 * and the entry lifecycle.
 *
 * Both surfaces write to one `consumption_entries` table and differ only in
 * which metrics they present, which entry kind they own, and how an entry's
 * contributions read back to the user. Those three are the abstract members.
 */
export abstract class ConsumptionStore<
	Slug extends ConsumptionDerivedMeasurementSlug,
	Metric extends ConsumptionDerivedMeasurementMetricDefinition & {
		slug: Slug;
	} = ConsumptionDerivedMeasurementMetricDefinition & { slug: Slug },
> {
	protected readonly entries: ConsumptionEntryRepository;
	protected readonly customConsumables: CustomConsumableRepository;
	protected readonly goals: GoalRepository;
	protected readonly tracked: TrackedMetricsRepository;
	protected readonly preferences: UnitPreferenceRepository;

	constructor(
		db: SQLiteDatabase,
		protected readonly now: () => Date = () => new Date(),
		protected readonly locale: () => string | undefined = systemLocale,
	) {
		this.entries = new ConsumptionEntryRepository(db);
		this.customConsumables = new CustomConsumableRepository(db);
		this.goals = new GoalRepository(db);
		this.tracked = new TrackedMetricsRepository(db);
		this.preferences = new UnitPreferenceRepository(db);
	}

	/** The entry kind this store owns; entries of the other kind are invisible. */
	protected abstract readonly kind: ConsumptionEntryKind;
	/** Names this store's subject in user-facing errors, e.g. "Food", "Drink". */
	protected abstract readonly noun: string;
	/** The metrics this store presents, in the order it presents them. */
	protected abstract readonly metricSlugs: readonly Slug[];

	/**
	 * What one entry contributed to a metric, or null to leave it unmentioned.
	 * Returning null is how a store hides a quantity it considers uninteresting.
	 */
	protected abstract contributionOf(
		entry: ConsumptionEntry,
		slug: Slug,
	): number | null;

	protected metrics(): Metric[] {
		const wanted = new Set<string>(this.metricSlugs);
		return listConsumptionDerivedMeasurements().filter(
			(metric): metric is Metric => wanted.has(metric.slug),
		);
	}

	protected trackedDefaults() {
		return this.metrics().map((metric) => ({
			metricSlug: metric.slug,
			position: metric.defaultPosition,
			enabled: false,
		}));
	}

	/** The local day the device is currently in. */
	protected today(): string {
		return localDayOf(this.now());
	}

	protected assertQuantity(quantity: number): void {
		if (!Number.isFinite(quantity) || quantity <= 0) {
			throw new RangeError(`${this.noun} quantity must be a positive number.`);
		}
	}

	/** Lower-cased subject for mid-sentence use, e.g. "Choose a custom drink". */
	protected get subject(): string {
		return this.noun.toLowerCase();
	}

	protected entryNotFound(): TypeError {
		return new TypeError(`${this.noun} entry not found.`);
	}

	protected customNotFound(): TypeError {
		return new TypeError(`Custom ${this.subject} not found.`);
	}

	/** Reads the shared half of a day screen. */
	protected async loadDayBase(
		localDay: string,
	): Promise<ConsumptionDaySnapshot<Metric>> {
		const weekFromLocalDay = shiftLocalDay(localDay, -(WEEK_DAYS - 1));
		const [dayEntries, allEntries, recents, preferences, overlays, goals] =
			await Promise.all([
				this.entries.listByDay(localDay),
				this.entries.listAll(),
				this.entries.listRecentByKind(this.kind, RECENTS_READ_LIMIT),
				this.preferences.resolveLatestPerDimension(),
				this.tracked.listResolved(this.trackedDefaults()),
				this.goals.listAll(),
			]);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		const weekEntries = allEntries.filter(
			(entry) =>
				entry.localDay >= weekFromLocalDay && entry.localDay <= localDay,
		);
		const locale = this.locale();

		const metrics = this.metrics().map((metric) => {
			const displayUnit = metricDisplayUnit(
				metric,
				preferenceByDimension,
				locale,
			) as DisplayUnit;
			const dayValue = consumptionMetricDayTotal(
				metric.slug,
				localDay,
				dayEntries,
			).value;
			const weekDailyValues = [
				...new Set(weekEntries.map((entry) => entry.localDay)),
			]
				.map(
					(day) =>
						consumptionMetricDayTotal(metric.slug, day, weekEntries).value,
				)
				.filter((value): value is number => value !== null);
			const weekValue =
				weekDailyValues.length === 0
					? null
					: weekDailyValues.reduce((sum, value) => sum + value, 0);
			const series = resolveMetricObservations(metric.slug, [], [], allEntries);
			return {
				metric,
				tracked: overlayBySlug.get(metric.slug)?.enabled ?? false,
				displayUnit,
				dayValue,
				dayFormatted:
					dayValue === null
						? null
						: formatMetricValue(metric, dayValue, displayUnit),
				weekValue,
				weekFormatted:
					weekValue === null
						? null
						: formatMetricValue(metric, weekValue, displayUnit),
				goals: goals
					.filter((goal) => goal.metricSlug === metric.slug)
					.map((goal) =>
						this.goalProgress(goal, metric, displayUnit, series, allEntries),
					),
			};
		});
		const ofKind = (entry: ConsumptionEntry) => entry.kind === this.kind;

		return {
			localDay,
			defaultTime:
				localDay === localDayOf(this.now())
					? localTimeOf(this.now().getTime())
					: DEFAULT_PAST_TIME,
			weekFromLocalDay,
			metrics,
			entries: dayEntries
				.filter(ofKind)
				.map((entry) => this.presentEntry(entry, metrics)),
			recents: uniqueRecents(recents)
				.slice(0, RECENTS_SHOWN)
				.map((entry) => this.presentEntry(entry, metrics)),
			recentLocalDays: [
				...new Set(
					allEntries
						.filter(ofKind)
						.map((entry) => entry.localDay)
						.filter((day) => day !== localDay),
				),
			].slice(0, OTHER_DAYS_SHOWN),
		};
	}

	async logCustom(
		consumableId: string,
		servingId: string,
		quantity: number,
		occurrence: ConsumptionOccurrence,
	): Promise<ConsumptionEntry> {
		this.assertQuantity(quantity);
		const consumable = await this.customConsumables.findById(consumableId);
		const serving = consumable?.servings.find(
			(candidate) => candidate.id === servingId,
		);
		if (consumable?.kind !== this.kind || !serving) {
			throw new TypeError(`Choose a custom ${this.subject} and serving.`);
		}
		return await this.entries.create({
			kind: this.kind,
			catalogueRef: null,
			consumableRef: `custom:${consumable.id}`,
			label: consumable.label,
			servingLabel: serving.label,
			quantity,
			volumeL: scaleNullable(serving.volumeL, quantity),
			ethanolKg: scaleNullable(serving.ethanolKg, quantity),
			caffeineKg: scaleNullable(serving.caffeineKg, quantity),
			energyKcal: scaleNullable(serving.energyKcal, quantity),
			proteinG: scaleNullable(serving.proteinG, quantity),
			carbsG: scaleNullable(serving.carbsG, quantity),
			fatG: scaleNullable(serving.fatG, quantity),
			...resolveLocalMoment(occurrence),
		});
	}

	async repeatEntry(
		id: string,
		occurrence: ConsumptionOccurrence = {
			localDay: localDayOf(this.now()),
			time: localTimeOf(this.now().getTime()),
		},
	): Promise<ConsumptionEntry> {
		const entry = await this.entries.findById(id);
		if (entry?.kind !== this.kind) {
			throw new TypeError(`Recent ${this.subject} not found.`);
		}
		const {
			id: _id,
			createdAt: _createdAt,
			updatedAt: _updatedAt,
			...snapshot
		} = entry;
		return await this.entries.create({
			...snapshot,
			...resolveLocalMoment(occurrence),
		});
	}

	/**
	 * Corrects an entry in place. Quantity is the only lever on the canonical
	 * amounts: they were snapshotted when logged and are rescaled proportionally
	 * rather than recomputed, so a later catalogue change cannot rewrite history.
	 */
	async updateEntry(
		id: string,
		edit: ConsumptionEntryEdit,
	): Promise<ConsumptionEntry> {
		const entry = await this.entries.findById(id);
		if (entry?.kind !== this.kind) {
			throw this.entryNotFound();
		}
		this.assertQuantity(edit.quantity);
		const scale = edit.quantity / entry.quantity;
		const updated = await this.entries.update(id, {
			catalogueRef: entry.catalogueRef,
			consumableRef: entry.consumableRef,
			label: edit.label,
			servingLabel: edit.servingLabel,
			quantity: edit.quantity,
			volumeL: scaleNullable(entry.volumeL, scale),
			ethanolKg: scaleNullable(entry.ethanolKg, scale),
			caffeineKg: scaleNullable(entry.caffeineKg, scale),
			energyKcal: scaleNullable(entry.energyKcal, scale),
			proteinG: scaleNullable(entry.proteinG, scale),
			carbsG: scaleNullable(entry.carbsG, scale),
			fatG: scaleNullable(entry.fatG, scale),
			...resolveLocalMoment(edit),
		});
		if (!updated) throw this.entryNotFound();
		return updated;
	}

	async deleteEntry(id: string): Promise<void> {
		const entry = await this.entries.findById(id);
		if (entry?.kind !== this.kind || !(await this.entries.delete(id))) {
			throw this.entryNotFound();
		}
	}

	async deleteCustom(id: string): Promise<void> {
		const existing = await this.customConsumables.findById(id);
		if (
			existing?.kind !== this.kind ||
			!(await this.customConsumables.delete(id))
		) {
			throw this.customNotFound();
		}
	}

	/** Creates or replaces a custom consumable and its components together. */
	protected async saveCustomConsumable(
		draft: CustomConsumableDraft,
		components: CreateCustomConsumableComponent[] = [],
	): Promise<CustomConsumable> {
		const fields = {
			label: draft.label,
			brand: draft.brand,
			isRecipe: draft.isRecipe,
			servings: draft.servings,
		};
		if (!draft.id) {
			return await this.customConsumables.create(
				{ kind: this.kind, ...fields },
				components,
			);
		}
		const existing = await this.customConsumables.findById(draft.id);
		if (existing?.kind !== this.kind) {
			throw this.customNotFound();
		}
		const currentComponents = await this.customConsumables.listComponents(
			draft.id,
		);
		const updated = await this.customConsumables.update(draft.id, fields);
		if (!updated) throw this.customNotFound();
		for (const component of currentComponents) {
			await this.customConsumables.deleteComponent(component.id);
		}
		for (const component of components) {
			await this.customConsumables.addComponent(draft.id, component);
		}
		return updated;
	}

	protected async trackedMetricSettings(): Promise<
		ConsumptionMetricSetting<Slug>[]
	> {
		const overlays = await this.tracked.listResolved(this.trackedDefaults());
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		return this.metrics().map((metric) => ({
			metricSlug: metric.slug,
			label: metric.label,
			tracked: overlayBySlug.get(metric.slug)?.enabled ?? false,
		}));
	}

	protected async configureTracked(
		metricSlug: string,
		enabled: boolean,
	): Promise<void> {
		const metric = this.resolveOwnMetric(metricSlug);
		const overlay = (
			await this.tracked.listResolved(this.trackedDefaults())
		).find((candidate) => candidate.metricSlug === metric.slug);
		await this.tracked.configure(
			metric.slug,
			overlay?.position ?? metric.defaultPosition,
			enabled,
		);
	}

	/**
	 * Opens a goal against one of this store's metrics. The target is parsed in
	 * the unit the user is currently reading and stored canonically, so changing
	 * unit preference later does not move the goalposts.
	 */
	async createGoal(
		metricSlug: string,
		targetInput: string,
		targetDate: string | null,
	): Promise<Goal> {
		const metric = this.resolveOwnMetric(metricSlug);
		const [entries, goals, preferences] = await Promise.all([
			this.entries.listAll(),
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
		const latest = resolveMetricObservations(metric.slug, [], [], entries).at(
			-1,
		);
		if (!latest) {
			throw new TypeError(`Log ${this.subject} before setting a goal.`);
		}
		if (parsed.canonicalValue === latest.value) {
			throw new RangeError("Choose a target different from your latest total.");
		}
		if (
			goals.some(
				(goal) =>
					goal.metricSlug === metric.slug && goalStatus(goal) === "active",
			)
		) {
			throw new TypeError("Finish the active goal before creating another.");
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

	protected resolveOwnMetric(metricSlug: string): Metric {
		const resolved = resolveMetric(metricSlug);
		if (
			resolved.kind !== "known" ||
			resolved.metric.kind !== "measurement" ||
			!("measurementSource" in resolved.metric) ||
			resolved.metric.measurementSource !== "consumption" ||
			!(this.metricSlugs as readonly string[]).includes(resolved.metric.slug)
		) {
			throw new TypeError(`Unknown ${this.subject} metric: ${metricSlug}`);
		}
		return resolved.metric as Metric;
	}

	/**
	 * Progress against a rolling daily mean rather than the last logged day's
	 * total: a single light (or heavy) day should not fully define "current",
	 * and days with nothing logged count as zero consumed. Both ends of the
	 * comparison use the same window so the percentage stays like-for-like.
	 */
	private goalProgress(
		goal: Goal,
		metric: Metric,
		displayUnit: DisplayUnit,
		series: ReturnType<typeof resolveMetricObservations>,
		entries: readonly ConsumptionEntry[],
	): ConsumptionGoalProgress {
		const hasEntries = series.length > 0;
		return resolveGoalProgress({
			goal,
			series,
			startValue: hasEntries
				? consumptionMetricTrailingDailyMean(
						metric.slug,
						localDayOf(new Date(goal.startedAt)),
						GOAL_MEAN_WINDOW_DAYS,
						entries,
					)
				: null,
			currentValue: hasEntries
				? consumptionMetricTrailingDailyMean(
						metric.slug,
						localDayOf(this.now()),
						GOAL_MEAN_WINDOW_DAYS,
						entries,
					)
				: null,
			format: (value) => formatMetricValue(metric, value, displayUnit),
		});
	}

	private presentEntry(
		entry: ConsumptionEntry,
		metrics: readonly ConsumptionMetricSummary<Metric>[],
	): PresentedConsumptionEntry {
		const contributions = metrics.flatMap(({ metric, displayUnit }) => {
			const value = this.contributionOf(entry, metric.slug);
			return value === null
				? []
				: [formatMetricValue(metric, value, displayUnit)];
		});
		return {
			entry,
			detail: `${entry.quantity} × ${entry.servingLabel ?? "serving"} · ${localTimeOf(
				entry.occurredAt,
			)}`,
			contributions: contributions.join(" · "),
		};
	}
}
