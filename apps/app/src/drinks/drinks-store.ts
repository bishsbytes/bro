import {
	ConsumptionEntryRepository,
	type ConsumptionEntry,
	type CreateConsumptionEntry,
	getDb,
	type Goal,
	GoalRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import {
	type DisplayUnit,
	formatMeasurement,
	isDisplayUnitForDimension,
	isDisplayUnitForPreferenceDimension,
	type ParsedMeasurement,
	parseMeasurement,
	resolveUnitPreference,
} from "@bro/domain";
import {
	DRINK_CATALOGUE,
	ethanolKgFromVolumeAndAbv,
	resolveDrink,
	snapshotDrinkServing,
} from "@bro/domain/drink-catalogue";
import {
	type ConsumptionDerivedMeasurementMetricDefinition,
	type ConsumptionDerivedMeasurementSlug,
	listConsumptionDerivedMeasurements,
	resolveMetric,
} from "@bro/domain/metric-registry";
import type { SQLiteDatabase } from "expo-sqlite";
import { localDayOf } from "../check-in/check-in-store";
import { consumptionMetricDayTotal } from "../consumption";
import {
	type GoalStatus,
	goalProgressPercent,
	goalStatus,
} from "../goals/goal-progress";
import {
	formatMetricValue,
	metricDisplayUnit,
} from "../health/metric-presentation";
import { resolveMetricObservations } from "../health/resolved-series";

export type DrinkOccurrence = {
	localDay: string;
	time: string;
};

export type FreeDrinkDraft = DrinkOccurrence & {
	label: string;
	servingLabel: string | null;
	quantity: number;
	volumeMl: number | null;
	abvPercent: number | null;
	caffeineMg: number | null;
	energyKcal: number | null;
};

export type DrinkEntryEdit = DrinkOccurrence & {
	label: string;
	servingLabel: string | null;
	quantity: number;
};

export type PresentedDrinkEntry = {
	entry: ConsumptionEntry;
	detail: string;
	contributions: string;
};

export type DrinkGoalProgress = {
	goal: Goal;
	status: GoalStatus;
	startValue: number | null;
	currentValue: number | null;
	progressPercent: number | null;
	targetFormatted: string;
	startFormatted: string | null;
	currentFormatted: string | null;
};

export type DrinkMetricSummary = {
	metric: ConsumptionDerivedMeasurementMetricDefinition;
	tracked: boolean;
	displayUnit: DisplayUnit;
	dayValue: number | null;
	dayFormatted: string | null;
	weekValue: number | null;
	weekFormatted: string | null;
	goals: DrinkGoalProgress[];
};

export type DrinkDaySnapshot = {
	localDay: string;
	defaultTime: string;
	entries: PresentedDrinkEntry[];
	metrics: DrinkMetricSummary[];
	weekFromLocalDay: string;
	recents: PresentedDrinkEntry[];
	recentLocalDays: string[];
	catalogue: typeof DRINK_CATALOGUE;
};

export type DrinkMetricSetting = {
	metricSlug: ConsumptionDerivedMeasurementSlug;
	label: string;
	tracked: boolean;
};

export type DrinkUnitOption = {
	unit: DisplayUnit;
	label: string;
};

export type DrinkUnitSetting = {
	dimension: "alcohol" | "volume";
	title: string;
	resolvedUnit: DisplayUnit;
	explicitUnit: DisplayUnit | null;
	preview: string;
	options: DrinkUnitOption[];
};

export type DrinkSettingsSnapshot = {
	metrics: DrinkMetricSetting[];
	units: DrinkUnitSetting[];
};

const DRINK_UNIT_DIMENSIONS = ["alcohol", "volume"] as const;
const UNIT_OPTIONS = {
	alcohol: [
		{ unit: "uk_unit", label: "UK units" },
		{ unit: "us_standard_drink", label: "US standard drinks" },
		{ unit: "g", label: "Grams" },
	],
	volume: [
		{ unit: "ml", label: "Millilitres" },
		{ unit: "l", label: "Litres" },
		{ unit: "fl_oz_uk", label: "UK fluid ounces" },
		{ unit: "fl_oz_us", label: "US fluid ounces" },
	],
} as const satisfies Record<
	(typeof DRINK_UNIT_DIMENSIONS)[number],
	readonly DrinkUnitOption[]
>;

const UNIT_PREVIEWS = {
	alcohol: { canonicalValue: 0.020_181_999, dimension: "mass" },
	volume: { canonicalValue: 0.568_261_25, dimension: "volume" },
} as const;

function systemLocale(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().locale;
	} catch {
		return undefined;
	}
}

function consumptionDefaults() {
	return listConsumptionDerivedMeasurements().map((metric) => ({
		metricSlug: metric.slug,
		position: metric.defaultPosition,
		enabled: false,
	}));
}

function parseMetricInput(
	metric: ConsumptionDerivedMeasurementMetricDefinition,
	displayUnit: DisplayUnit,
	input: string,
	locale: string | undefined,
): ParsedMeasurement {
	if (
		metric.dimension === "mass" &&
		isDisplayUnitForDimension("mass", displayUnit)
	) {
		return parseMeasurement(input, "mass", displayUnit, locale);
	}
	if (
		metric.dimension === "length" &&
		isDisplayUnitForDimension("length", displayUnit)
	) {
		return parseMeasurement(input, "length", displayUnit, locale);
	}
	if (
		metric.dimension === "fraction" &&
		isDisplayUnitForDimension("fraction", displayUnit)
	) {
		return parseMeasurement(input, "fraction", displayUnit, locale);
	}
	if (
		metric.dimension === "volume" &&
		isDisplayUnitForDimension("volume", displayUnit)
	) {
		return parseMeasurement(input, "volume", displayUnit, locale);
	}
	if (
		metric.dimension === "energy" &&
		isDisplayUnitForDimension("energy", displayUnit)
	) {
		return parseMeasurement(input, "energy", displayUnit, locale);
	}
	throw new TypeError(
		`Unit ${displayUnit} does not measure ${metric.dimension}.`,
	);
}

function unitPreview(
	dimension: "alcohol" | "volume",
	unit: DisplayUnit,
): string {
	const preview = UNIT_PREVIEWS[dimension];
	if (dimension === "alcohol" && isDisplayUnitForDimension("mass", unit)) {
		return formatMeasurement(preview.canonicalValue, "mass", unit);
	}
	if (dimension === "volume" && isDisplayUnitForDimension("volume", unit)) {
		return formatMeasurement(preview.canonicalValue, "volume", unit);
	}
	throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
}

function assertFiniteNonNegative(value: number | null, label: string): void {
	if (value !== null && (!Number.isFinite(value) || value < 0)) {
		throw new RangeError(`${label} must be empty or a non-negative number.`);
	}
}

function assertQuantity(quantity: number): void {
	if (!Number.isFinite(quantity) || quantity <= 0) {
		throw new RangeError("Drink quantity must be a positive number.");
	}
}

function occurrenceOf({ localDay, time }: DrinkOccurrence): {
	occurredAt: number;
	localDay: string;
	tzOffsetMinutes: number;
} {
	const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDay);
	const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
	if (!dayMatch || !timeMatch) {
		throw new TypeError("Choose a real date and a time in HH:mm format.");
	}
	const year = Number(dayMatch[1]);
	const month = Number(dayMatch[2]);
	const day = Number(dayMatch[3]);
	const hour = Number(timeMatch[1]);
	const minute = Number(timeMatch[2]);
	if (hour > 23 || minute > 59) {
		throw new TypeError("Choose a real date and a time in HH:mm format.");
	}
	const occurred = new Date(year, month - 1, day, hour, minute, 0, 0);
	if (
		occurred.getFullYear() !== year ||
		occurred.getMonth() !== month - 1 ||
		occurred.getDate() !== day
	) {
		throw new TypeError("Choose a real date and a time in HH:mm format.");
	}
	return {
		occurredAt: occurred.getTime(),
		localDay,
		tzOffsetMinutes: occurred.getTimezoneOffset(),
	};
}

function localDayOffset(localDay: string, offset: number): string {
	const date = new Date(`${localDay}T12:00:00`);
	if (!Number.isFinite(date.getTime()) || localDayOf(date) !== localDay) {
		throw new TypeError("Choose a real date in YYYY-MM-DD format.");
	}
	date.setDate(date.getDate() + offset);
	return localDayOf(date);
}

function timeOf(timestamp: number): string {
	const date = new Date(timestamp);
	return `${String(date.getHours()).padStart(2, "0")}:${String(
		date.getMinutes(),
	).padStart(2, "0")}`;
}

function recentKey(entry: ConsumptionEntry): string {
	return JSON.stringify([
		entry.catalogueRef,
		entry.label,
		entry.servingLabel,
		entry.quantity,
		entry.volumeL,
		entry.ethanolKg,
		entry.caffeineKg,
		entry.energyKcal,
	]);
}

function uniqueRecents(entries: readonly ConsumptionEntry[]): ConsumptionEntry[] {
	const seen = new Set<string>();
	return entries.filter((entry) => {
		const key = recentKey(entry);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export class DrinksStore {
	private readonly entries: ConsumptionEntryRepository;
	private readonly goals: GoalRepository;
	private readonly tracked: TrackedMetricsRepository;
	private readonly preferences: UnitPreferenceRepository;

	constructor(
		db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly locale: () => string | undefined = systemLocale,
	) {
		this.entries = new ConsumptionEntryRepository(db);
		this.goals = new GoalRepository(db);
		this.tracked = new TrackedMetricsRepository(db);
		this.preferences = new UnitPreferenceRepository(db);
	}

	async loadToday(): Promise<DrinkDaySnapshot> {
		return await this.loadDay(localDayOf(this.now()));
	}

	async loadDay(localDay: string): Promise<DrinkDaySnapshot> {
		const weekFromLocalDay = localDayOffset(localDay, -6);
		const [dayEntries, allEntries, recents, preferences, overlays, goals] =
			await Promise.all([
				this.entries.listByDay(localDay),
				this.entries.listAll(),
				this.entries.listRecent(24),
				this.preferences.resolveLatestPerDimension(),
				this.tracked.listResolved(consumptionDefaults()),
				this.goals.listAll(),
			]);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		const locale = this.locale();
		const metrics = listConsumptionDerivedMeasurements().map((metric) => {
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
			const weekEntries = allEntries.filter(
				(entry) =>
					entry.localDay >= weekFromLocalDay && entry.localDay <= localDay,
			);
			const weekDailyValues = [...new Set(weekEntries.map((entry) => entry.localDay))]
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
					.map((goal) => this.goalProgress(goal, metric, displayUnit, series)),
			};
		});

		return {
			localDay,
			defaultTime:
				localDay === localDayOf(this.now())
					? timeOf(this.now().getTime())
					: "20:00",
			weekFromLocalDay,
			entries: dayEntries.map((entry) =>
				this.presentEntry(entry, metrics),
			),
			metrics,
			recents: uniqueRecents(recents)
				.slice(0, 8)
				.map((entry) => this.presentEntry(entry, metrics)),
			recentLocalDays: [
				...new Set(
					allEntries
						.map((entry) => entry.localDay)
						.filter((day) => day !== localDay),
				),
			].slice(0, 7),
			catalogue: DRINK_CATALOGUE,
		};
	}

	async logCatalogue(
		catalogueId: string,
		servingId: string,
		quantity: number,
		occurrence: DrinkOccurrence,
	): Promise<ConsumptionEntry> {
		const drink = resolveDrink(catalogueId);
		const serving = drink?.servings.find((candidate) => candidate.id === servingId);
		if (!drink || !serving) {
			throw new TypeError("Choose a drink and serving from the catalogue.");
		}
		const snapshot = snapshotDrinkServing(drink, serving, quantity);
		return await this.entries.create({
			kind: "drink",
			...snapshot,
			...occurrenceOf(occurrence),
		});
	}

	async repeatEntry(
		id: string,
		occurrence: DrinkOccurrence = {
			localDay: localDayOf(this.now()),
			time: timeOf(this.now().getTime()),
		},
	): Promise<ConsumptionEntry> {
		const entry = await this.entries.findById(id);
		if (!entry) throw new TypeError("Recent drink not found.");
		const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...snapshot } =
			entry;
		return await this.entries.create({
			...snapshot,
			...occurrenceOf(occurrence),
		});
	}

	async logFree(draft: FreeDrinkDraft): Promise<ConsumptionEntry> {
		assertQuantity(draft.quantity);
		assertFiniteNonNegative(draft.volumeMl, "Drink volume");
		assertFiniteNonNegative(draft.abvPercent, "Drink ABV");
		assertFiniteNonNegative(draft.caffeineMg, "Drink caffeine");
		assertFiniteNonNegative(draft.energyKcal, "Drink energy");
		if (draft.abvPercent !== null && draft.abvPercent > 100) {
			throw new RangeError("Drink ABV must not exceed 100%.");
		}
		if (draft.abvPercent !== null && draft.volumeMl === null) {
			throw new TypeError("Enter a volume when entering an ABV.");
		}
		const volumeL =
			draft.volumeMl === null
				? null
				: (draft.volumeMl / 1_000) * draft.quantity;
		const input: CreateConsumptionEntry = {
			kind: "drink",
			catalogueRef: null,
			label: draft.label,
			servingLabel: draft.servingLabel,
			quantity: draft.quantity,
			volumeL,
			ethanolKg:
				draft.abvPercent === null || volumeL === null
					? null
					: ethanolKgFromVolumeAndAbv(volumeL, draft.abvPercent),
			caffeineKg:
				draft.caffeineMg === null
					? null
					: (draft.caffeineMg / 1_000_000) * draft.quantity,
			energyKcal:
				draft.energyKcal === null
					? null
					: draft.energyKcal * draft.quantity,
			...occurrenceOf(draft),
		};
		return await this.entries.create(input);
	}

	async updateEntry(id: string, edit: DrinkEntryEdit): Promise<ConsumptionEntry> {
		const entry = await this.entries.findById(id);
		if (!entry) throw new TypeError("Drink entry not found.");
		assertQuantity(edit.quantity);
		const scale = edit.quantity / entry.quantity;
		const updated = await this.entries.update(id, {
			catalogueRef: entry.catalogueRef,
			label: edit.label,
			servingLabel: edit.servingLabel,
			quantity: edit.quantity,
			volumeL: entry.volumeL === null ? null : entry.volumeL * scale,
			ethanolKg: entry.ethanolKg === null ? null : entry.ethanolKg * scale,
			caffeineKg: entry.caffeineKg === null ? null : entry.caffeineKg * scale,
			energyKcal: entry.energyKcal === null ? null : entry.energyKcal * scale,
			...occurrenceOf(edit),
		});
		if (!updated) throw new TypeError("Drink entry not found.");
		return updated;
	}

	async deleteEntry(id: string): Promise<void> {
		if (!(await this.entries.delete(id))) {
			throw new TypeError("Drink entry not found.");
		}
	}

	async loadSettings(): Promise<DrinkSettingsSnapshot> {
		const [overlays, preferences] = await Promise.all([
			this.tracked.listResolved(consumptionDefaults()),
			this.preferences.resolveLatestPerDimension(),
		]);
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		const storedByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		return {
			metrics: listConsumptionDerivedMeasurements().map((metric) => ({
				metricSlug: metric.slug,
				label: metric.label,
				tracked: overlayBySlug.get(metric.slug)?.enabled ?? false,
			})),
			units: DRINK_UNIT_DIMENSIONS.map((dimension) => {
				const storedUnit = storedByDimension.get(dimension);
				const explicitUnit =
					storedUnit !== undefined &&
					isDisplayUnitForPreferenceDimension(dimension, storedUnit)
						? storedUnit
						: null;
				const resolvedUnit = resolveUnitPreference(
					dimension,
					storedUnit,
					this.locale(),
				);
				return {
					dimension,
					title: dimension === "alcohol" ? "Alcohol" : "Fluid",
					resolvedUnit,
					explicitUnit,
					preview: unitPreview(dimension, resolvedUnit),
					options: [...UNIT_OPTIONS[dimension]],
				};
			}),
		};
	}

	async setTracked(
		metricSlug: string,
		enabled: boolean,
	): Promise<DrinkSettingsSnapshot> {
		const metric = this.resolveConsumptionMetric(metricSlug);
		const overlay = (await this.tracked.listResolved(consumptionDefaults())).find(
			(candidate) => candidate.metricSlug === metric.slug,
		);
		await this.tracked.configure(
			metric.slug,
			overlay?.position ?? metric.defaultPosition,
			enabled,
		);
		return await this.loadSettings();
	}

	async setUnit(
		dimension: "alcohol" | "volume",
		unit: string,
	): Promise<DrinkSettingsSnapshot> {
		if (!isDisplayUnitForPreferenceDimension(dimension, unit)) {
			throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
		}
		await this.preferences.set(dimension, unit);
		return await this.loadSettings();
	}

	async createGoal(
		metricSlug: string,
		targetInput: string,
		targetDate: string | null,
	): Promise<Goal> {
		const metric = this.resolveConsumptionMetric(metricSlug);
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
		const latest = resolveMetricObservations(
			metric.slug,
			[],
			[],
			entries,
		).at(-1);
		if (!latest) throw new TypeError("Log a drink before setting a goal.");
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
			direction:
				parsed.canonicalValue > latest.value ? "increase" : "decrease",
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

	private resolveConsumptionMetric(
		metricSlug: string,
	): ConsumptionDerivedMeasurementMetricDefinition {
		const resolved = resolveMetric(metricSlug);
		if (
			resolved.kind !== "known" ||
			resolved.metric.kind !== "measurement" ||
			!("measurementSource" in resolved.metric) ||
			resolved.metric.measurementSource !== "consumption"
		) {
			throw new TypeError(`Unknown drink metric: ${metricSlug}`);
		}
		return resolved.metric;
	}

	private goalProgress(
		goal: Goal,
		metric: ConsumptionDerivedMeasurementMetricDefinition,
		displayUnit: DisplayUnit,
		series: ReturnType<typeof resolveMetricObservations>,
	): DrinkGoalProgress {
		const startValue =
			series.filter((row) => row.observedAt <= goal.startedAt).at(-1)?.value ??
			null;
		const currentValue = series.at(-1)?.value ?? null;
		const format = (value: number) =>
			formatMetricValue(metric, value, displayUnit);
		return {
			goal,
			status: goalStatus(goal),
			startValue,
			currentValue,
			progressPercent: goalProgressPercent(goal, startValue, currentValue),
			targetFormatted: format(goal.targetValue),
			startFormatted: startValue === null ? null : format(startValue),
			currentFormatted: currentValue === null ? null : format(currentValue),
		};
	}

	private presentEntry(
		entry: ConsumptionEntry,
		metrics: readonly DrinkMetricSummary[],
	): PresentedDrinkEntry {
		const fieldByMetric = {
			alcohol_intake: entry.ethanolKg,
			caffeine_intake: entry.caffeineKg,
			fluid_intake: entry.volumeL,
			energy_intake: entry.energyKcal,
		} as const;
		const contributions = metrics.flatMap(({ metric, displayUnit }) => {
			const value = fieldByMetric[metric.slug];
			return value !== null && value > 0
				? [formatMetricValue(metric, value, displayUnit)]
				: [];
		});
		return {
			entry,
			detail: `${entry.quantity} × ${entry.servingLabel ?? "serving"} · ${timeOf(
				entry.occurredAt,
			)}`,
			contributions: contributions.join(" · "),
		};
	}
}

export function createDrinksStore(): DrinksStore {
	return new DrinksStore(getDb());
}

export function previousLocalDay(localDay: string): string {
	return localDayOffset(localDay, -1);
}

export function occurrenceTime(timestamp: number): string {
	return timeOf(timestamp);
}
