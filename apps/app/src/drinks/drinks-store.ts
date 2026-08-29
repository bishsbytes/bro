import {
	type ConsumptionEntry,
	type ConsumptionEntryKind,
	type CustomConsumable,
	type CustomConsumableServing,
	getDb,
} from "@bro/database-app";
import {
	type DisplayUnit,
	formatMeasurement,
	isDisplayUnitForDimension,
	isDisplayUnitForPreferenceDimension,
	resolveLocalMoment,
	resolveUnitPreference,
} from "@bro/domain";
import {
	ethanolKgFromVolumeAndAbv,
	snapshotDrinkServing,
} from "@bro/domain/drink-catalogue";
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
} from "../consumption/consumption-store";
import { drinkCatalogue, resolveDrink } from "../content";
import { i18n } from "../i18n";
import { unitLabel } from "../units/unit-settings-store";
import { unitWords } from "../units/unit-words";

const DRINK_METRIC_SLUGS = [
	"alcohol_intake",
	"caffeine_intake",
	"fluid_intake",
	"energy_intake",
] as const satisfies readonly ConsumptionDerivedMeasurementSlug[];

type DrinkMetricSlug = (typeof DRINK_METRIC_SLUGS)[number];
type DrinkMetric = ConsumptionDerivedMeasurementMetricDefinition & {
	slug: DrinkMetricSlug;
};

const MILLILITRES_PER_LITRE = 1_000;
const MICROGRAMS_PER_KILOGRAM = 1_000_000;

export type DrinkOccurrence = ConsumptionOccurrence;
export type DrinkEntryEdit = ConsumptionEntryEdit;
export type PresentedDrinkEntry = PresentedConsumptionEntry;
export type DrinkGoalProgress = ConsumptionGoalProgress;
export type DrinkMetricSummary = ConsumptionMetricSummary<DrinkMetric>;
export type DrinkMetricSetting = ConsumptionMetricSetting<DrinkMetricSlug>;

export type FreeDrinkDraft = DrinkOccurrence & {
	label: string;
	servingLabel: string | null;
	quantity: number;
	volumeMl: number | null;
	abvPercent: number | null;
	caffeineMg: number | null;
	energyKcal: number | null;
};

export type CustomDrinkDraft = {
	id?: string;
	label: string;
	brand: string | null;
	servings: CustomConsumableServing[];
};

export type DrinkDaySnapshot = ConsumptionDaySnapshot<DrinkMetric> & {
	catalogue: ReturnType<typeof drinkCatalogue>;
	customDrinks: CustomConsumable[];
};

export type DrinkUnitOption = {
	unit: DisplayUnit;
	label: string;
};

export type DrinkUnitDimension = "alcohol" | "volume";

export type DrinkUnitSetting = {
	dimension: DrinkUnitDimension;
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

/** The units each dimension offers; names come from the settings catalogue. */
const UNIT_CHOICES = {
	alcohol: ["uk_unit", "us_standard_drink", "g"],
	volume: ["ml", "l", "fl_oz_uk", "fl_oz_us"],
} as const satisfies Record<DrinkUnitDimension, readonly DisplayUnit[]>;

function unitOptions(dimension: DrinkUnitDimension): DrinkUnitOption[] {
	return UNIT_CHOICES[dimension].map((unit) => ({
		unit,
		label: unitLabel(unit),
	}));
}

/** A pint of lager, shown so a unit choice can be judged against something real. */
const UNIT_PREVIEWS = {
	alcohol: { canonicalValue: 0.020_181_999, dimension: "mass" },
	volume: { canonicalValue: 0.568_261_25, dimension: "volume" },
} as const;

function unitPreview(
	dimension: DrinkUnitDimension,
	unit: DisplayUnit,
	locale: string | undefined,
): string {
	const preview = UNIT_PREVIEWS[dimension];
	if (dimension === "alcohol" && isDisplayUnitForDimension("mass", unit)) {
		return formatMeasurement(
			preview.canonicalValue,
			"mass",
			unit,
			locale,
			unitWords(),
		);
	}
	if (dimension === "volume" && isDisplayUnitForDimension("volume", unit)) {
		return formatMeasurement(
			preview.canonicalValue,
			"volume",
			unit,
			locale,
			unitWords(),
		);
	}
	throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
}

export class DrinksStore extends ConsumptionStore<DrinkMetricSlug> {
	protected readonly kind: ConsumptionEntryKind = "drink";
	protected readonly metricSlugs = DRINK_METRIC_SLUGS;

	/**
	 * Unlike food, a zero here is noise rather than information: every soft drink
	 * carries an explicit zero ethanol, and listing "0 units" against each one
	 * would bury the entries that do contain something.
	 */
	protected contributionOf(
		entry: ConsumptionEntry,
		slug: DrinkMetricSlug,
	): number | null {
		const value = {
			alcohol_intake: entry.ethanolKg,
			caffeine_intake: entry.caffeineKg,
			fluid_intake: entry.volumeL,
			energy_intake: entry.energyKcal,
		}[slug];
		return value !== null && value > 0 ? value : null;
	}

	async loadToday(): Promise<DrinkDaySnapshot> {
		return await this.loadDay(this.today());
	}

	async loadDay(localDay: string): Promise<DrinkDaySnapshot> {
		const [base, customDrinks] = await Promise.all([
			this.loadDayBase(localDay),
			this.customConsumables.listByKind("drink"),
		]);
		return { ...base, catalogue: drinkCatalogue(), customDrinks };
	}

	/** Logs a catalogue drink as the immutable snapshot the catalogue defines. */
	async logCatalogue(
		catalogueId: string,
		servingId: string,
		quantity: number,
		occurrence: DrinkOccurrence,
	): Promise<ConsumptionEntry> {
		const drink = resolveDrink(catalogueId);
		const serving = drink?.servings.find(
			(candidate) => candidate.id === servingId,
		);
		if (!drink || !serving) {
			throw new TypeError(i18n.t("validation:drinks.chooseCatalogue"));
		}
		return await this.entries.create({
			kind: "drink",
			...snapshotDrinkServing(drink, serving, quantity),
			...resolveLocalMoment(occurrence),
		});
	}

	async logFree(draft: FreeDrinkDraft): Promise<ConsumptionEntry> {
		this.assertQuantity(draft.quantity);
		assertFiniteNonNegative(draft.volumeMl, "drinkVolume");
		assertFiniteNonNegative(draft.abvPercent, "drinkAbv");
		assertFiniteNonNegative(draft.caffeineMg, "drinkCaffeine");
		assertFiniteNonNegative(draft.energyKcal, "drinkEnergy");
		if (draft.abvPercent !== null && draft.abvPercent > 100) {
			throw new RangeError(i18n.t("validation:drinks.abvMaximum"));
		}
		if (draft.abvPercent !== null && draft.volumeMl === null) {
			throw new TypeError(i18n.t("validation:drinks.volumeWithAbv"));
		}
		const volumeL =
			draft.volumeMl === null
				? null
				: (draft.volumeMl / MILLILITRES_PER_LITRE) * draft.quantity;
		return await this.entries.create({
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
					: (draft.caffeineMg / MICROGRAMS_PER_KILOGRAM) * draft.quantity,
			energyKcal:
				draft.energyKcal === null ? null : draft.energyKcal * draft.quantity,
			...resolveLocalMoment(draft),
		});
	}

	async saveCustom(draft: CustomDrinkDraft): Promise<CustomConsumable> {
		return await this.saveCustomConsumable({ ...draft, isRecipe: false });
	}

	async loadSettings(): Promise<DrinkSettingsSnapshot> {
		const [metrics, preferences] = await Promise.all([
			this.trackedMetricSettings(),
			this.preferences.resolveLatestPerDimension(),
		]);
		const storedByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		return {
			metrics,
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
					title: i18n.t(`settings:dimensions.${dimension}Title`),
					resolvedUnit,
					explicitUnit,
					preview: unitPreview(dimension, resolvedUnit, this.locale()),
					options: unitOptions(dimension),
				};
			}),
		};
	}

	async setTracked(
		metricSlug: string,
		enabled: boolean,
	): Promise<DrinkSettingsSnapshot> {
		await this.configureTracked(metricSlug, enabled);
		return await this.loadSettings();
	}

	async setUnit(
		dimension: DrinkUnitDimension,
		unit: string,
	): Promise<DrinkSettingsSnapshot> {
		if (!isDisplayUnitForPreferenceDimension(dimension, unit)) {
			throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
		}
		await this.preferences.set(dimension, unit);
		return await this.loadSettings();
	}
}

export function createDrinksStore(): DrinksStore {
	return new DrinksStore(getDb());
}
