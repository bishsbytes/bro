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
	systemLocale,
	type UnitPreferenceDimension,
	type WeekStartDay,
} from "@bro/domain";
import type { SQLiteDatabase } from "expo-sqlite";
import { i18n } from "../i18n";

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

const WEEK_START_PREFERENCE_DIMENSION = "week_start";

/** `labelKey` is a key in the `settings` catalogue, not copy. */
export const WEEK_START_OPTIONS = [
	{ day: "monday", labelKey: "units.monday" },
	{ day: "sunday", labelKey: "units.sunday" },
	{ day: "saturday", labelKey: "units.saturday" },
] as const satisfies readonly { day: WeekStartDay; labelKey: string }[];

function isWeekStartDay(value: string): value is WeekStartDay {
	return WEEK_START_OPTIONS.some((option) => option.day === value);
}

type LocaleWithWeekInfo = Intl.Locale & {
	getWeekInfo?: () => { firstDay: number };
};

/** Uses locale week metadata where the runtime exposes it. */
export function defaultWeekStart(locale: string | undefined): WeekStartDay {
	if (!locale) return "monday";
	try {
		const localeValue = new Intl.Locale(locale) as LocaleWithWeekInfo;
		if (typeof localeValue.getWeekInfo !== "function") return "monday";
		const { firstDay } = localeValue.getWeekInfo();
		if (firstDay === 7) return "sunday";
		if (firstDay === 6) return "saturday";
		return "monday";
	} catch {
		return "monday";
	}
}

/** Catalogue keys, not copy; `%` is not a legal key so it is spelled out. */
const UNIT_LABEL_KEYS = {
	kg: "unitNames.kg",
	lb: "unitNames.lb",
	st: "unitNames.st",
	cm: "unitNames.cm",
	in: "unitNames.in",
	ft: "unitNames.ft",
	"%": "unitNames.percent",
	g: "unitNames.g",
	mg: "unitNames.mg",
	uk_unit: "unitNames.uk_unit",
	us_standard_drink: "unitNames.us_standard_drink",
	ml: "unitNames.ml",
	l: "unitNames.l",
	fl_oz_uk: "unitNames.fl_oz_uk",
	fl_oz_us: "unitNames.fl_oz_us",
	kcal: "unitNames.kcal",
	kJ: "unitNames.kJ",
} as const satisfies Record<DisplayUnit, string>;

export function unitLabel(unit: DisplayUnit): string {
	return i18n.t(`settings:${UNIT_LABEL_KEYS[unit]}`);
}

const GENERAL_UNIT_PREFERENCE_DIMENSIONS = [
	"mass",
	"height",
	"length",
	"fraction",
] as const satisfies readonly UnitPreferenceDimension[];
type GeneralUnitPreferenceDimension =
	(typeof GENERAL_UNIT_PREFERENCE_DIMENSIONS)[number];

function settingCopy(dimension: GeneralUnitPreferenceDimension): {
	title: string;
	description: string;
} {
	return {
		title: i18n.t(`settings:dimensions.${dimension}Title`),
		description: i18n.t(`settings:dimensions.${dimension}Description`),
	};
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
			locale,
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
			preferences
				.filter(
					(preference) =>
						preference.dimension !== WEEK_START_PREFERENCE_DIMENSION,
				)
				.map((preference) => [preference.dimension, preference.unit]),
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
					...settingCopy(dimension),
					options: DISPLAY_UNITS_BY_PREFERENCE_DIMENSION[dimension].map(
						(unit) => ({
							unit,
							label: unitLabel(unit),
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

	async loadWeekStart(): Promise<WeekStartDay> {
		const preferences = await this.preferences.resolveLatestPerDimension();
		const stored = preferences.find(
			(preference) => preference.dimension === WEEK_START_PREFERENCE_DIMENSION,
		)?.unit;
		if (stored !== undefined) {
			return isWeekStartDay(stored) ? stored : "monday";
		}
		return defaultWeekStart(this.locale());
	}

	async setWeekStart(day: WeekStartDay): Promise<void> {
		if (!isWeekStartDay(day)) {
			throw new TypeError(`Unsupported week start: ${day}.`);
		}
		await this.preferences.set(WEEK_START_PREFERENCE_DIMENSION, day);
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
