import {
	type ConsumptionEntry,
	type ConsumptionEntryKind,
	type CreateCustomConsumableComponent,
	type CustomConsumable,
	type CustomConsumableComponent,
	type CustomConsumableServing,
	getDb,
} from "@bro/database-app";
import { resolveLocalMoment } from "@bro/domain";
import type { FoodSearchResult } from "@bro/domain/food-search";
import type {
	ConsumptionDerivedMeasurementMetricDefinition,
	ConsumptionDerivedMeasurementSlug,
} from "@bro/domain/metric-registry";
import {
	assertFiniteNonNegative,
	type ConsumptionDaySnapshot,
	type ConsumptionEntryEdit,
	type ConsumptionGoalProgress,
	type ConsumptionMetricSetting,
	type ConsumptionMetricSummary,
	type ConsumptionOccurrence,
	ConsumptionStore,
	type PresentedConsumptionEntry,
	scaleNullable,
} from "../consumption/consumption-store";

export const FOOD_METRIC_SLUGS = [
	"energy_intake",
	"protein_intake",
	"carbs_intake",
	"fat_intake",
] as const satisfies readonly ConsumptionDerivedMeasurementSlug[];

type FoodMetricSlug = (typeof FOOD_METRIC_SLUGS)[number];

/** Grams as the user enters them, kilograms as the metric registry stores them. */
const GRAMS_PER_KILOGRAM = 1_000;

type FoodMetric = ConsumptionDerivedMeasurementMetricDefinition & {
	slug: FoodMetricSlug;
};

export type FoodOccurrence = ConsumptionOccurrence;
export type FoodEntryEdit = ConsumptionEntryEdit;
export type PresentedFoodEntry = PresentedConsumptionEntry;
export type FoodGoalProgress = ConsumptionGoalProgress;
export type FoodMetricSummary = ConsumptionMetricSummary<FoodMetric>;
export type FoodMetricSetting = ConsumptionMetricSetting<FoodMetricSlug>;

export type FreeFoodDraft = FoodOccurrence & {
	label: string;
	servingLabel: string | null;
	quantity: number;
	energyKcal: number | null;
	proteinG: number | null;
	carbsG: number | null;
	fatG: number | null;
};

export type CustomFoodDraft = {
	id?: string;
	label: string;
	brand: string | null;
	isRecipe: boolean;
	servings: CustomConsumableServing[];
	components: CreateCustomConsumableComponent[];
};

export type CustomFood = {
	consumable: CustomConsumable;
	components: CustomConsumableComponent[];
};

export type FoodDaySnapshot = ConsumptionDaySnapshot<FoodMetric> & {
	customFoods: CustomFood[];
};

export type FoodSettingsSnapshot = {
	metrics: FoodMetricSetting[];
};

export class FoodStore extends ConsumptionStore<FoodMetricSlug> {
	protected readonly kind: ConsumptionEntryKind = "food";
	protected readonly noun = "Food";
	protected readonly metricSlugs = FOOD_METRIC_SLUGS;

	/**
	 * Macronutrients are logged in grams but registered as masses in kilograms;
	 * energy is already canonical. A zero is a real answer here — "0 g fat" is
	 * worth showing — so only an absent value is suppressed.
	 */
	protected contributionOf(
		entry: ConsumptionEntry,
		slug: FoodMetricSlug,
	): number | null {
		switch (slug) {
			case "energy_intake":
				return entry.energyKcal;
			case "protein_intake":
				return scaleNullable(entry.proteinG, 1 / GRAMS_PER_KILOGRAM);
			case "carbs_intake":
				return scaleNullable(entry.carbsG, 1 / GRAMS_PER_KILOGRAM);
			case "fat_intake":
				return scaleNullable(entry.fatG, 1 / GRAMS_PER_KILOGRAM);
		}
	}

	async loadToday(): Promise<FoodDaySnapshot> {
		return await this.loadDay(this.today());
	}

	async loadDay(localDay: string): Promise<FoodDaySnapshot> {
		const [base, customConsumables] = await Promise.all([
			this.loadDayBase(localDay),
			this.customConsumables.listByKind("food"),
		]);
		return {
			...base,
			customFoods: await Promise.all(
				customConsumables.map(async (consumable) => ({
					consumable,
					components: await this.customConsumables.listComponents(
						consumable.id,
					),
				})),
			),
		};
	}

	async logFree(draft: FreeFoodDraft): Promise<ConsumptionEntry> {
		this.assertQuantity(draft.quantity);
		assertFiniteNonNegative(draft.energyKcal, "Food energy");
		assertFiniteNonNegative(draft.proteinG, "Food protein");
		assertFiniteNonNegative(draft.carbsG, "Food carbohydrate");
		assertFiniteNonNegative(draft.fatG, "Food fat");
		return await this.entries.create({
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
			...resolveLocalMoment(draft),
		});
	}

	/**
	 * Logs a provider search hit as an immutable snapshot. The provider ref is
	 * kept for attribution only — nothing re-reads it, so a later change or
	 * takedown upstream cannot alter what was logged.
	 */
	async logSearchResult(
		result: FoodSearchResult,
		servingId: string,
		quantity: number,
		occurrence: FoodOccurrence,
	): Promise<ConsumptionEntry> {
		this.assertQuantity(quantity);
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
			...resolveLocalMoment(occurrence),
		});
	}

	async saveCustom(draft: CustomFoodDraft): Promise<CustomConsumable> {
		if (!draft.isRecipe && draft.components.length > 0) {
			throw new TypeError("Only recipes can have components.");
		}
		return await this.saveCustomConsumable(draft, draft.components);
	}

	async loadSettings(): Promise<FoodSettingsSnapshot> {
		return { metrics: await this.trackedMetricSettings() };
	}

	async setTracked(
		metricSlug: string,
		enabled: boolean,
	): Promise<FoodSettingsSnapshot> {
		await this.configureTracked(metricSlug, enabled);
		return await this.loadSettings();
	}
}

export function createFoodStore(): FoodStore {
	return new FoodStore(getDb());
}
