import {
	type ConsumptionEntry,
	ConsumptionEntryRepository,
	type CreateConsumptionEntry,
	type CreateCustomConsumableComponent,
	type CustomConsumable,
	type CustomConsumableComponent,
	CustomConsumableRepository,
	type CustomConsumableServing,
	type Goal,
	GoalRepository,
	getDb,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import {
	type DisplayUnit,
	isDisplayUnitForDimension,
	type ParsedMeasurement,
	parseMeasurement,
} from "@bro/domain";
import type { FoodSearchResult } from "@bro/domain/food-search";
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

export const FOOD_METRIC_SLUGS = [
	"energy_intake",
	"protein_intake",
	"carbs_intake",
	"fat_intake",
] as const satisfies readonly ConsumptionDerivedMeasurementSlug[];

type FoodMetricSlug = (typeof FOOD_METRIC_SLUGS)[number];

export type FoodOccurrence = {
	localDay: string;
	time: string;
};

export type FreeFoodDraft = FoodOccurrence & {
	label: string;
	servingLabel: string | null;
	quantity: number;
	energyKcal: number | null;
	proteinG: number | null;
	carbsG: number | null;
	fatG: number | null;
};

export type FoodEntryEdit = FoodOccurrence & {
	label: string;
	servingLabel: string | null;
	quantity: number;
};

export type CustomFoodDraft = {
	id?: string;
	label: string;
	brand: string | null;
	isRecipe: boolean;
	servings: CustomConsumableServing[];
	components: CreateCustomConsumableComponent[];
};

export type PresentedFoodEntry = {
	entry: ConsumptionEntry;
	detail: string;
	contributions: string;
};

export type FoodGoalProgress = {
	goal: Goal;
	status: GoalStatus;
	startValue: number | null;
	currentValue: number | null;
	progressPercent: number | null;
	targetFormatted: string;
	startFormatted: string | null;
	currentFormatted: string | null;
};

export type FoodMetricSummary = {
	metric: ConsumptionDerivedMeasurementMetricDefinition & {
		slug: FoodMetricSlug;
	};
	tracked: boolean;
	displayUnit: DisplayUnit;
	dayValue: number | null;
	dayFormatted: string | null;
	weekValue: number | null;
	weekFormatted: string | null;
	goals: FoodGoalProgress[];
};

export type CustomFood = {
	consumable: CustomConsumable;
	components: CustomConsumableComponent[];
};

export type FoodDaySnapshot = {
	localDay: string;
	defaultTime: string;
	entries: PresentedFoodEntry[];
	metrics: FoodMetricSummary[];
	weekFromLocalDay: string;
	recents: PresentedFoodEntry[];
	recentLocalDays: string[];
	customFoods: CustomFood[];
};

export type FoodMetricSetting = {
	metricSlug: FoodMetricSlug;
	label: string;
	tracked: boolean;
};

export type FoodSettingsSnapshot = {
	metrics: FoodMetricSetting[];
};

function systemLocale(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().locale;
	} catch {
		return undefined;
	}
}

function foodMetrics(): FoodMetricSummary["metric"][] {
	return listConsumptionDerivedMeasurements().filter(
		(metric): metric is FoodMetricSummary["metric"] =>
			FOOD_METRIC_SLUGS.includes(metric.slug as FoodMetricSlug),
	);
}

function foodDefaults() {
	return foodMetrics().map((metric) => ({
		metricSlug: metric.slug,
		position: metric.defaultPosition,
		enabled: false,
	}));
}

function assertFiniteNonNegative(value: number | null, label: string): void {
	if (value !== null && (!Number.isFinite(value) || value < 0)) {
		throw new RangeError(`${label} must be empty or a non-negative number.`);
	}
}

function assertQuantity(quantity: number): void {
	if (!Number.isFinite(quantity) || quantity <= 0) {
		throw new RangeError("Food quantity must be a positive number.");
	}
}

function occurrenceOf({ localDay, time }: FoodOccurrence): {
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
		entry.consumableRef,
		entry.label,
		entry.servingLabel,
		entry.quantity,
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

function scaleNullable(value: number | null | undefined, quantity: number) {
	return value == null ? null : value * quantity;
}

function parseMetricInput(
	metric: FoodMetricSummary["metric"],
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
		metric.dimension === "energy" &&
		isDisplayUnitForDimension("energy", displayUnit)
	) {
		return parseMeasurement(input, "energy", displayUnit, locale);
	}
	throw new TypeError(
		`Unit ${displayUnit} does not measure ${metric.dimension}.`,
	);
}

export class FoodStore {
	private readonly entries: ConsumptionEntryRepository;
	private readonly customConsumables: CustomConsumableRepository;
	private readonly goals: GoalRepository;
	private readonly tracked: TrackedMetricsRepository;
	private readonly preferences: UnitPreferenceRepository;

	constructor(
		db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly locale: () => string | undefined = systemLocale,
	) {
		this.entries = new ConsumptionEntryRepository(db);
		this.customConsumables = new CustomConsumableRepository(db);
		this.goals = new GoalRepository(db);
		this.tracked = new TrackedMetricsRepository(db);
		this.preferences = new UnitPreferenceRepository(db);
	}

	async loadToday(): Promise<FoodDaySnapshot> {
		return await this.loadDay(localDayOf(this.now()));
	}

	async loadDay(localDay: string): Promise<FoodDaySnapshot> {
		const weekFromLocalDay = localDayOffset(localDay, -6);
		const [
			allDayEntries,
			allEntries,
			recents,
			customFoods,
			preferences,
			overlays,
			goals,
		] = await Promise.all([
			this.entries.listByDay(localDay),
			this.entries.listAll(),
			this.entries.listRecentByKind("food", 24),
			this.customConsumables.listByKind("food"),
			this.preferences.resolveLatestPerDimension(),
			this.tracked.listResolved(foodDefaults()),
			this.goals.listAll(),
		]);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		const locale = this.locale();
		const metrics = foodMetrics().map((metric) => {
			const displayUnit = metricDisplayUnit(
				metric,
				preferenceByDimension,
				locale,
			) as DisplayUnit;
			const dayValue = consumptionMetricDayTotal(
				metric.slug,
				localDay,
				allDayEntries,
			).value;
			const weekEntries = allEntries.filter(
				(entry) =>
					entry.localDay >= weekFromLocalDay && entry.localDay <= localDay,
			);
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
					.map((goal) => this.goalProgress(goal, metric, displayUnit, series)),
			};
		});
		const foodEntries = allDayEntries.filter((entry) => entry.kind === "food");
		return {
			localDay,
			defaultTime:
				localDay === localDayOf(this.now())
					? timeOf(this.now().getTime())
					: "20:00",
			weekFromLocalDay,
			entries: foodEntries.map((entry) => this.presentEntry(entry, metrics)),
			metrics,
			recents: uniqueRecents(recents)
				.slice(0, 8)
				.map((entry) => this.presentEntry(entry, metrics)),
			recentLocalDays: [
				...new Set(
					allEntries
						.filter((entry) => entry.kind === "food")
						.map((entry) => entry.localDay)
						.filter((day) => day !== localDay),
				),
			].slice(0, 7),
			customFoods: await Promise.all(
				customFoods.map(async (consumable) => ({
					consumable,
					components: await this.customConsumables.listComponents(
						consumable.id,
					),
				})),
			),
		};
	}

	async logFree(draft: FreeFoodDraft): Promise<ConsumptionEntry> {
		assertQuantity(draft.quantity);
		assertFiniteNonNegative(draft.energyKcal, "Food energy");
		assertFiniteNonNegative(draft.proteinG, "Food protein");
		assertFiniteNonNegative(draft.carbsG, "Food carbohydrate");
		assertFiniteNonNegative(draft.fatG, "Food fat");
		const input: CreateConsumptionEntry = {
			kind: "food",
			catalogueRef: null,
			consumableRef: null,
			label: draft.label,
			servingLabel: draft.servingLabel,
			quantity: draft.quantity,
			volumeL: null,
			ethanolKg: null,
			caffeineKg: null,
			energyKcal: scaleNullable(draft.energyKcal, draft.quantity),
			proteinG: scaleNullable(draft.proteinG, draft.quantity),
			carbsG: scaleNullable(draft.carbsG, draft.quantity),
			fatG: scaleNullable(draft.fatG, draft.quantity),
			...occurrenceOf(draft),
		};
		return await this.entries.create(input);
	}

	async logCustom(
		consumableId: string,
		servingId: string,
		quantity: number,
		occurrence: FoodOccurrence,
	): Promise<ConsumptionEntry> {
		assertQuantity(quantity);
		const consumable = await this.customConsumables.findById(consumableId);
		const serving = consumable?.servings.find(
			(candidate) => candidate.id === servingId,
		);
		if (consumable?.kind !== "food" || !serving) {
			throw new TypeError("Choose a custom food and serving.");
		}
		return await this.entries.create({
			kind: "food",
			catalogueRef: null,
			consumableRef: `custom:${consumable.id}`,
			label: consumable.label,
			servingLabel: serving.label,
			quantity,
			volumeL: null,
			ethanolKg: null,
			caffeineKg: null,
			energyKcal: scaleNullable(serving.energyKcal, quantity),
			proteinG: scaleNullable(serving.proteinG, quantity),
			carbsG: scaleNullable(serving.carbsG, quantity),
			fatG: scaleNullable(serving.fatG, quantity),
			...occurrenceOf(occurrence),
		});
	}

	async logSearchResult(
		result: FoodSearchResult,
		servingId: string,
		quantity: number,
		occurrence: FoodOccurrence,
	): Promise<ConsumptionEntry> {
		assertQuantity(quantity);
		const serving = result.servings.find(
			(candidate) => candidate.id === servingId,
		);
		if (!/^[^:\s]+:.+$/.test(result.ref) || !serving) {
			throw new TypeError("Choose a searched food and serving.");
		}
		assertFiniteNonNegative(serving.energyKcal, "Food energy");
		assertFiniteNonNegative(serving.proteinG, "Food protein");
		assertFiniteNonNegative(serving.carbsG, "Food carbohydrate");
		assertFiniteNonNegative(serving.fatG, "Food fat");
		return await this.entries.create({
			kind: "food",
			catalogueRef: null,
			consumableRef: result.ref,
			label: result.brand ? `${result.brand} · ${result.label}` : result.label,
			servingLabel: serving.label,
			quantity,
			volumeL: null,
			ethanolKg: null,
			caffeineKg: null,
			energyKcal: scaleNullable(serving.energyKcal, quantity),
			proteinG: scaleNullable(serving.proteinG, quantity),
			carbsG: scaleNullable(serving.carbsG, quantity),
			fatG: scaleNullable(serving.fatG, quantity),
			...occurrenceOf(occurrence),
		});
	}

	async repeatEntry(
		id: string,
		occurrence: FoodOccurrence = {
			localDay: localDayOf(this.now()),
			time: timeOf(this.now().getTime()),
		},
	): Promise<ConsumptionEntry> {
		const entry = await this.entries.findById(id);
		if (entry?.kind !== "food") throw new TypeError("Recent food not found.");
		const {
			id: _id,
			createdAt: _createdAt,
			updatedAt: _updatedAt,
			...snapshot
		} = entry;
		return await this.entries.create({
			...snapshot,
			...occurrenceOf(occurrence),
		});
	}

	async updateEntry(
		id: string,
		edit: FoodEntryEdit,
	): Promise<ConsumptionEntry> {
		const entry = await this.entries.findById(id);
		if (entry?.kind !== "food") throw new TypeError("Food entry not found.");
		assertQuantity(edit.quantity);
		const scale = edit.quantity / entry.quantity;
		const updated = await this.entries.update(id, {
			catalogueRef: entry.catalogueRef,
			consumableRef: entry.consumableRef ?? null,
			label: edit.label,
			servingLabel: edit.servingLabel,
			quantity: edit.quantity,
			volumeL: null,
			ethanolKg: null,
			caffeineKg: null,
			energyKcal: scaleNullable(entry.energyKcal, scale),
			proteinG: scaleNullable(entry.proteinG, scale),
			carbsG: scaleNullable(entry.carbsG, scale),
			fatG: scaleNullable(entry.fatG, scale),
			...occurrenceOf(edit),
		});
		if (!updated) throw new TypeError("Food entry not found.");
		return updated;
	}

	async deleteEntry(id: string): Promise<void> {
		const entry = await this.entries.findById(id);
		if (entry?.kind !== "food" || !(await this.entries.delete(id))) {
			throw new TypeError("Food entry not found.");
		}
	}

	async saveCustom(draft: CustomFoodDraft): Promise<CustomConsumable> {
		if (!draft.isRecipe && draft.components.length > 0) {
			throw new TypeError("Only recipes can have components.");
		}
		if (!draft.id) {
			return await this.customConsumables.create(
				{
					kind: "food",
					label: draft.label,
					brand: draft.brand,
					isRecipe: draft.isRecipe,
					servings: draft.servings,
				},
				draft.components,
			);
		}
		const existing = await this.customConsumables.findById(draft.id);
		if (existing?.kind !== "food") {
			throw new TypeError("Custom food not found.");
		}
		const currentComponents = await this.customConsumables.listComponents(
			draft.id,
		);
		if (!draft.isRecipe) {
			for (const component of currentComponents) {
				await this.customConsumables.deleteComponent(component.id);
			}
		}
		const updated = await this.customConsumables.update(draft.id, {
			label: draft.label,
			brand: draft.brand,
			isRecipe: draft.isRecipe,
			servings: draft.servings,
		});
		if (!updated) throw new TypeError("Custom food not found.");
		for (const component of currentComponents) {
			await this.customConsumables.deleteComponent(component.id);
		}
		for (const component of draft.components) {
			await this.customConsumables.addComponent(draft.id, component);
		}
		return updated;
	}

	async deleteCustom(id: string): Promise<void> {
		const existing = await this.customConsumables.findById(id);
		if (
			existing?.kind !== "food" ||
			!(await this.customConsumables.delete(id))
		) {
			throw new TypeError("Custom food not found.");
		}
	}

	async loadSettings(): Promise<FoodSettingsSnapshot> {
		const overlays = await this.tracked.listResolved(foodDefaults());
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		return {
			metrics: foodMetrics().map((metric) => ({
				metricSlug: metric.slug,
				label: metric.label,
				tracked: overlayBySlug.get(metric.slug)?.enabled ?? false,
			})),
		};
	}

	async setTracked(
		metricSlug: string,
		enabled: boolean,
	): Promise<FoodSettingsSnapshot> {
		const metric = this.resolveFoodMetric(metricSlug);
		const overlay = (await this.tracked.listResolved(foodDefaults())).find(
			(candidate) => candidate.metricSlug === metric.slug,
		);
		await this.tracked.configure(
			metric.slug,
			overlay?.position ?? metric.defaultPosition,
			enabled,
		);
		return await this.loadSettings();
	}

	async createGoal(
		metricSlug: string,
		targetInput: string,
		targetDate: string | null,
	): Promise<Goal> {
		const metric = this.resolveFoodMetric(metricSlug);
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
		if (!latest) throw new TypeError("Log food before setting a goal.");
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

	private resolveFoodMetric(metricSlug: string): FoodMetricSummary["metric"] {
		const resolved = resolveMetric(metricSlug);
		if (
			resolved.kind !== "known" ||
			resolved.metric.kind !== "measurement" ||
			!("measurementSource" in resolved.metric) ||
			resolved.metric.measurementSource !== "consumption" ||
			!FOOD_METRIC_SLUGS.includes(resolved.metric.slug as FoodMetricSlug)
		) {
			throw new TypeError(`Unknown food metric: ${metricSlug}`);
		}
		return resolved.metric as FoodMetricSummary["metric"];
	}

	private goalProgress(
		goal: Goal,
		metric: FoodMetricSummary["metric"],
		displayUnit: DisplayUnit,
		series: ReturnType<typeof resolveMetricObservations>,
	): FoodGoalProgress {
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
		metrics: readonly FoodMetricSummary[],
	): PresentedFoodEntry {
		const valueByMetric: Record<FoodMetricSlug, number | null> = {
			energy_intake: entry.energyKcal,
			protein_intake: entry.proteinG == null ? null : entry.proteinG / 1_000,
			carbs_intake: entry.carbsG == null ? null : entry.carbsG / 1_000,
			fat_intake: entry.fatG == null ? null : entry.fatG / 1_000,
		};
		const contributions = metrics.flatMap(({ metric, displayUnit }) => {
			const value = valueByMetric[metric.slug];
			return value !== null
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

export function createFoodStore(): FoodStore {
	return new FoodStore(getDb());
}

export function previousFoodLocalDay(localDay: string): string {
	return localDayOffset(localDay, -1);
}

export function foodOccurrenceTime(timestamp: number): string {
	return timeOf(timestamp);
}
