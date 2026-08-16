import {
	getDb,
	type UnitPreferenceRepository,
	UnitPreferenceRepository as DatabaseUnitPreferenceRepository,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	DIMENSIONS,
	DISPLAY_UNITS_BY_DIMENSION,
	type Dimension,
	type DisplayUnit,
	formatMeasurement,
	isDisplayUnitForDimension,
	resolveDisplayUnit,
} from ".";

export type UnitOption = {
	unit: DisplayUnit;
	label: string;
};

export type UnitSetting = {
	dimension: Dimension;
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
	"%": "Percent",
};

const SETTING_COPY: Record<Dimension, { title: string; description: string }> =
	{
		mass: {
			title: "Weight",
			description: "Used for weight entries, history, trends, and goals.",
		},
		length: {
			title: "Length",
			description: "Used for waist measurements.",
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

function previewFor(
	dimension: Dimension,
	storedUnit: string | null | undefined,
	locale: string | undefined,
): { resolvedUnit: DisplayUnit; preview: string } {
	if (dimension === "mass") {
		const resolvedUnit = resolveDisplayUnit(dimension, storedUnit, locale);
		return {
			resolvedUnit,
			preview: formatMeasurement(78, dimension, resolvedUnit),
		};
	}
	if (dimension === "length") {
		const resolvedUnit = resolveDisplayUnit(dimension, storedUnit, locale);
		return {
			resolvedUnit,
			preview: formatMeasurement(0.84, dimension, resolvedUnit),
		};
	}
	const resolvedUnit = resolveDisplayUnit(dimension, storedUnit, locale);
	return {
		resolvedUnit,
		preview: formatMeasurement(0.185, dimension, resolvedUnit),
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
			settings: DIMENSIONS.map((dimension) => {
				const storedUnit = storedByDimension.get(dimension);
				const explicitUnit =
					storedUnit !== undefined &&
					isDisplayUnitForDimension(dimension, storedUnit)
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
					options: DISPLAY_UNITS_BY_DIMENSION[dimension].map((unit) => ({
						unit,
						label: UNIT_LABELS[unit],
					})),
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

	async set(dimension: Dimension, unit: string): Promise<UnitSettingsSnapshot> {
		if (!isDisplayUnitForDimension(dimension, unit)) {
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
