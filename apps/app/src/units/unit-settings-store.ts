import {
	UnitPreferenceRepository as DatabaseUnitPreferenceRepository,
	getDb,
	type UnitPreferenceRepository,
} from "@bro/database-app";
import {
	DIMENSION_BY_UNIT_PREFERENCE,
	DISPLAY_UNITS_BY_PREFERENCE_DIMENSION,
	type DisplayUnit,
	formatMeasurement,
	isDisplayUnitForPreferenceDimension,
	resolveUnitPreference,
	type UnitPreferenceDimension,
} from "@bro/domain";
import type { SQLiteDatabase } from "expo-sqlite";

export type UnitOption = {
	unit: DisplayUnit;
	label: string;
};

export type UnitSetting = {
	dimension: UnitPreferenceDimension;
	title: string;
	description: string;
	options: UnitOption[];
	resolvedUnit: DisplayUnit;
	explicitUnit: DisplayUnit | null;
	resolutionSource: "locale" | "explicit" | "fallback";
	preview: string;
};

export type UnitSettingsSnapshot = {
	settings: UnitSetting[];
};

type UnitPreferences = Pick<
	UnitPreferenceRepository,
	"resolveLatestPerDimension" | "set"
>;

const UNIT_LABELS: Record<DisplayUnit, string> = {
	kg: "Kilograms",
	lb: "Pounds",
	st: "Stones & pounds",
	cm: "Centimetres",
	in: "Inches",
	ft: "Feet & inches",
	"%": "Percent",
	g: "Grams",
	mg: "Milligrams",
	uk_unit: "UK units",
	us_standard_drink: "US standard drinks",
	ml: "Millilitres",
	l: "Litres",
	fl_oz_uk: "UK fluid ounces",
	fl_oz_us: "US fluid ounces",
	kcal: "Kilocalories",
	kJ: "Kilojoules",
};

const GENERAL_UNIT_PREFERENCE_DIMENSIONS = [
	"mass",
	"height",
	"length",
	"fraction",
] as const satisfies readonly UnitPreferenceDimension[];
type GeneralUnitPreferenceDimension =
	(typeof GENERAL_UNIT_PREFERENCE_DIMENSIONS)[number];

const SETTING_COPY: Record<
	GeneralUnitPreferenceDimension,
	{ title: string; description: string }
> = {
	mass: {
		title: "Weight",
		description: "Used for weight entries, history, trends, and goals.",
	},
	height: {
		title: "Height",
		description: "Used for height measurements.",
	},
	length: {
		title: "Other body measurements",
		description: "Used for waist and other circumference measurements.",
	},
	fraction: {
		title: "Body fat",
		description: "Body fat is always displayed as a percentage.",
	},
};

function systemLocale(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().locale;
	} catch {
		return undefined;
	}
}

/** Canonical values chosen to read naturally in every unit on offer. */
const PREVIEW_CANONICAL_VALUES = {
	mass: 78,
	height: 1.7,
	length: 0.84,
	fraction: 0.185,
} as const satisfies Record<GeneralUnitPreferenceDimension, number>;

function previewFor(
	dimension: GeneralUnitPreferenceDimension,
	storedUnit: string | null | undefined,
	locale: string | undefined,
): { resolvedUnit: DisplayUnit; preview: string } {
	const resolvedUnit = resolveUnitPreference(dimension, storedUnit, locale);
	return {
		resolvedUnit,
		preview: formatMeasurement(
			PREVIEW_CANONICAL_VALUES[dimension],
			DIMENSION_BY_UNIT_PREFERENCE[dimension],
			resolvedUnit,
		),
	};
}

export class UnitSettingsStore {
	constructor(
		private readonly preferences: UnitPreferences,
		private readonly locale: () => string | undefined = systemLocale,
	) {}

	async load(): Promise<UnitSettingsSnapshot> {
		const preferences = await this.preferences.resolveLatestPerDimension();
		const storedByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const locale = this.locale();
		return {
			settings: GENERAL_UNIT_PREFERENCE_DIMENSIONS.map((dimension) => {
				const storedUnit = storedByDimension.get(dimension);
				const explicitUnit =
					storedUnit !== undefined &&
					isDisplayUnitForPreferenceDimension(dimension, storedUnit)
						? storedUnit
						: null;
				const { resolvedUnit, preview } = previewFor(
					dimension,
					storedUnit,
					locale,
				);
				return {
					dimension,
					...SETTING_COPY[dimension],
					options: DISPLAY_UNITS_BY_PREFERENCE_DIMENSION[dimension].map(
						(unit) => ({
							unit,
							label: UNIT_LABELS[unit],
						}),
					),
					resolvedUnit,
					explicitUnit,
					resolutionSource:
						storedUnit === undefined
							? "locale"
							: explicitUnit
								? "explicit"
								: "fallback",
					preview,
				};
			}),
		};
	}

	async set(
		dimension: UnitPreferenceDimension,
		unit: string,
	): Promise<UnitSettingsSnapshot> {
		if (!isDisplayUnitForPreferenceDimension(dimension, unit)) {
			throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
		}
		await this.preferences.set(dimension, unit);
		return await this.load();
	}
}

export function createUnitSettingsStore(
	db: SQLiteDatabase = getDb(),
): UnitSettingsStore {
	return new UnitSettingsStore(new DatabaseUnitPreferenceRepository(db));
}
