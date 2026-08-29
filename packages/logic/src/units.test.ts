import {
	CANONICAL_STORAGE_UNITS,
	DIMENSION_BY_UNIT_PREFERENCE,
	DISPLAY_RESOLUTIONS,
	DISPLAY_UNITS_BY_DIMENSION,
	DISPLAY_UNITS_BY_PREFERENCE_DIMENSION,
	defaultUnitPreference,
	formatIntrinsicMeasurement,
	formatMeasurement,
	fromCanonical,
	INVALID_MEASUREMENT_MESSAGE,
	isCompoundDisplayUnit,
	isDisplayUnitForDimension,
	KILOGRAMS_ETHANOL_PER_UK_UNIT,
	KILOGRAMS_ETHANOL_PER_US_STANDARD_DRINK,
	KILOGRAMS_PER_POUND,
	KILOJOULES_PER_KILOCALORIE,
	LITRES_PER_UK_FLUID_OUNCE,
	LITRES_PER_US_FLUID_OUNCE,
	METRES_PER_FOOT,
	METRES_PER_INCH,
	measurementEntryOf,
	parseMeasurement,
	parseMeasurementEntry,
	resolveUnitPreference,
	toCanonical,
	UNIT_PREFERENCE_DIMENSIONS,
} from "@bro/domain";
import { resolveMetric } from "@bro/domain/metric-registry";
import { metricDisplayUnit } from "./health/metric-presentation";

function canonicalValueOf(result: ReturnType<typeof parseMeasurement>): number {
	if (!result.ok) throw new Error(result.error);
	return result.canonicalValue;
}

describe("measurement units", () => {
	it("pins canonical units, display choices, and display resolutions", () => {
		expect(CANONICAL_STORAGE_UNITS).toEqual({
			mass: "kg",
			length: "m",
			fraction: "fraction",
			volume: "l",
			energy: "kcal",
			time: "s",
			count: "count",
			rate_bpm: "bpm",
		});
		expect(DISPLAY_UNITS_BY_DIMENSION).toEqual({
			mass: ["kg", "lb", "st", "g", "mg", "uk_unit", "us_standard_drink"],
			length: ["cm", "in", "ft"],
			fraction: ["%"],
			volume: ["ml", "l", "fl_oz_uk", "fl_oz_us"],
			energy: ["kcal", "kJ"],
		});
		expect(DISPLAY_UNITS_BY_PREFERENCE_DIMENSION).toEqual({
			mass: ["kg", "lb", "st"],
			height: ["cm", "ft"],
			length: ["cm", "in"],
			fraction: ["%"],
			alcohol: ["uk_unit", "us_standard_drink", "g"],
			volume: ["ml", "l", "fl_oz_uk", "fl_oz_us"],
		});
		expect(DIMENSION_BY_UNIT_PREFERENCE).toEqual({
			mass: "mass",
			height: "length",
			length: "length",
			fraction: "fraction",
			alcohol: "mass",
			volume: "volume",
		});
		expect(DISPLAY_RESOLUTIONS).toEqual({
			kg: 0.1,
			lb: 0.2,
			st: 1,
			cm: 0.5,
			in: 0.25,
			ft: 1,
			"%": 0.1,
			g: 0.1,
			mg: 1,
			uk_unit: 0.1,
			us_standard_drink: 0.1,
			ml: 1,
			l: 0.1,
			fl_oz_uk: 0.1,
			fl_oz_us: 0.1,
			kcal: 1,
			kJ: 1,
		});
	});

	it("formats fixed health dimensions without creating unit preferences", () => {
		expect(formatIntrinsicMeasurement(27_720, "time", "en-GB")).toBe(
			"7 h 42 m",
		);
		expect(formatIntrinsicMeasurement(2_520, "time", "en-GB")).toBe("42 m");
		expect(formatIntrinsicMeasurement(10_432, "count", "en-GB")).toBe("10,432");
		expect(formatIntrinsicMeasurement(61, "rate_bpm", "en-GB")).toBe("61 bpm");
		expect(formatIntrinsicMeasurement(61.25, "rate_bpm", "en-GB")).toBe(
			"61.3 bpm",
		);
	});

	it("renders numbers in the reader's locale", () => {
		// A comma decimal separator and a non-breaking-space group separator are
		// what a French reader expects, and what the parser accepts back.
		expect(formatMeasurement(78.017_887_64, "mass", "kg", "fr-FR")).toBe(
			"78,0 kg",
		);
		expect(formatMeasurement(0.1846, "fraction", "%", "de-DE")).toBe("18,5%");
		expect(formatIntrinsicMeasurement(10_432, "count", "de-DE")).toBe("10.432");
	});

	it("seeds editable fields without a group separator", () => {
		// The field feeds a numeric keyboard and `parseMeasurement`, neither of
		// which accepts a thousands separator; the decimal separator still
		// follows the locale so the value round-trips.
		expect(measurementEntryOf(78.017_887_64, "mass", "kg", "fr-FR")).toEqual({
			major: "78,0",
			minor: "",
		});
		expect(measurementEntryOf(9_999, "mass", "kg", "en-GB").major).toBe(
			"9999.0",
		);
	});

	it("falls back to a plain rendering when the locale is unusable", () => {
		expect(formatMeasurement(78.017_887_64, "mass", "kg", "not a locale")).toBe(
			"78.0 kg",
		);
	});

	it("uses exact mass and length definitions", () => {
		expect(toCanonical(1, "mass", "lb")).toBe(KILOGRAMS_PER_POUND);
		expect(toCanonical(1, "length", "in")).toBe(METRES_PER_INCH);
		expect(toCanonical(1, "length", "ft")).toBe(METRES_PER_FOOT);
		expect(fromCanonical(KILOGRAMS_PER_POUND, "mass", "lb")).toBe(1);
		expect(fromCanonical(METRES_PER_INCH, "length", "in")).toBe(1);
		expect(fromCanonical(METRES_PER_FOOT, "length", "ft")).toBe(1);
	});

	it("uses exact volume, energy, and alcohol definitions", () => {
		expect(toCanonical(1, "volume", "fl_oz_uk")).toBe(
			LITRES_PER_UK_FLUID_OUNCE,
		);
		expect(toCanonical(1, "volume", "fl_oz_us")).toBe(
			LITRES_PER_US_FLUID_OUNCE,
		);
		expect(toCanonical(KILOJOULES_PER_KILOCALORIE, "energy", "kJ")).toBe(1);
		expect(toCanonical(1, "mass", "uk_unit")).toBe(
			KILOGRAMS_ETHANOL_PER_UK_UNIT,
		);
		expect(toCanonical(1, "mass", "us_standard_drink")).toBe(
			KILOGRAMS_ETHANOL_PER_US_STANDARD_DRINK,
		);

		for (const [dimension, unit] of [
			["volume", "ml"],
			["volume", "l"],
			["volume", "fl_oz_uk"],
			["volume", "fl_oz_us"],
			["energy", "kcal"],
			["energy", "kJ"],
			["mass", "g"],
			["mass", "mg"],
			["mass", "uk_unit"],
			["mass", "us_standard_drink"],
		] as const) {
			const displayValue = fromCanonical(0.314_159, dimension, unit);
			expect(toCanonical(displayValue, dimension, unit)).toBeCloseTo(
				0.314_159,
				12,
			);
		}
	});

	it.each(["12 st 4", "12st 4lb", "12 stones 4 pounds"])(
		"parses compound stone input %s into kilograms",
		(input) => {
			const parsed = parseMeasurement(input, "mass", "st");
			expect(canonicalValueOf(parsed)).toBeCloseTo(
				172 * KILOGRAMS_PER_POUND,
				12,
			);
			expect(formatMeasurement(canonicalValueOf(parsed), "mass", "st")).toBe(
				"12 st 4 lb",
			);
		},
	);

	it("treats a bare value as stones when stones are preferred", () => {
		const parsed = parseMeasurement("12", "mass", "st");
		expect(canonicalValueOf(parsed)).toBeCloseTo(
			12 * 14 * KILOGRAMS_PER_POUND,
			12,
		);
	});

	it.each(["5 ft 11 in", "5ft 11", "5' 11\""])(
		"parses compound height input %s into metres",
		(input) => {
			const parsed = parseMeasurement(input, "length", "ft");
			expect(canonicalValueOf(parsed)).toBeCloseTo(
				(5 + 11 / 12) * METRES_PER_FOOT,
				12,
			);
			expect(formatMeasurement(canonicalValueOf(parsed), "length", "ft")).toBe(
				"5 ft 11 in",
			);
		},
	);

	it("parses unit suffixes and locale decimal separators", () => {
		expect(canonicalValueOf(parseMeasurement("172 lb", "mass", "lb"))).toBe(
			172 * KILOGRAMS_PER_POUND,
		);
		expect(
			canonicalValueOf(parseMeasurement("78,0 kg", "mass", "kg", "de-DE")),
		).toBe(78);
		expect(
			canonicalValueOf(parseMeasurement("31.5 in", "length", "in")),
		).toBeCloseTo(31.5 * METRES_PER_INCH, 12);
		expect(canonicalValueOf(parseMeasurement("18.5%", "fraction", "%"))).toBe(
			0.185,
		);
	});

	it.each([
		["", "mass", "kg"],
		["weight", "mass", "kg"],
		["78,0", "mass", "kg"],
		["12 st 14 lb", "mass", "st"],
		["12.5 st 4 lb", "mass", "st"],
		["5 ft 12 in", "length", "ft"],
		["5.5 ft 4 in", "length", "ft"],
		["-1", "length", "cm"],
		["101%", "fraction", "%"],
		["-1 ml", "volume", "ml"],
		["water", "volume", "l"],
	] as const)(
		"rejects malformed or out-of-domain input %s",
		(input, dimension, unit) => {
			expect(parseMeasurement(input, dimension, unit)).toEqual({
				ok: false,
				error: INVALID_MEASUREMENT_MESSAGE,
			});
		},
	);

	it("formats at the signed-off resolution without implied precision", () => {
		expect(formatMeasurement(78.01788764, "mass", "kg")).toBe("78.0 kg");
		expect(formatMeasurement(80, "mass", "lb")).toBe("176.4 lb");
		expect(formatMeasurement(0.8, "length", "cm")).toBe("80.0 cm");
		expect(formatMeasurement(0.8, "length", "in")).toBe("31.50 in");
		expect(formatMeasurement(1.8, "length", "ft")).toBe("5 ft 11 in");
		expect(formatMeasurement(0.1846, "fraction", "%")).toBe("18.5%");
		expect(formatMeasurement(0.020_181_999, "mass", "uk_unit")).toBe(
			"2.6 units",
		);
		expect(formatMeasurement(0.020_181_999, "mass", "g")).toBe("20.2 g");
		expect(formatMeasurement(0.000_095, "mass", "mg")).toBe("95 mg");
		expect(formatMeasurement(0.568_261_25, "volume", "fl_oz_uk")).toBe(
			"20.0 fl oz",
		);
		expect(formatMeasurement(125, "energy", "kcal")).toBe("125 kcal");
	});

	it("carries rounded pounds into the next stone", () => {
		const almostTwelveStone = toCanonical(11 + 13.6 / 14, "mass", "st");
		expect(formatMeasurement(almostTwelveStone, "mass", "st")).toBe(
			"12 st 0 lb",
		);
		expect(formatMeasurement(almostTwelveStone, "mass", "st")).not.toContain(
			"14 lb",
		);
	});

	it("never changes the canonical value while display units switch", () => {
		const canonical = canonicalValueOf(
			parseMeasurement("12 st 4 lb", "mass", "st"),
		);
		for (const unit of DISPLAY_UNITS_BY_DIMENSION.mass) {
			formatMeasurement(canonical, "mass", unit);
		}
		expect(canonical).toBeCloseTo(172 * KILOGRAMS_PER_POUND, 12);
	});

	it("uses regional defaults only when no preference exists", () => {
		expect(defaultUnitPreference("mass", "en-US")).toBe("lb");
		expect(defaultUnitPreference("length", "en-US")).toBe("in");
		expect(defaultUnitPreference("mass", "en-GB")).toBe("st");
		expect(defaultUnitPreference("length", "en-GB")).toBe("cm");
		expect(defaultUnitPreference("mass", "fr-FR")).toBe("kg");
		expect(defaultUnitPreference("length", "fr-FR")).toBe("cm");
		expect(defaultUnitPreference("fraction", "en-US")).toBe("%");
		expect(defaultUnitPreference("height", "en-US")).toBe("ft");
		expect(defaultUnitPreference("height", "en-GB")).toBe("ft");
		expect(defaultUnitPreference("height", "fr-FR")).toBe("cm");
		expect(defaultUnitPreference("alcohol", "en-GB")).toBe("uk_unit");
		expect(defaultUnitPreference("alcohol", "en-US")).toBe("us_standard_drink");
		expect(defaultUnitPreference("alcohol", "fr-FR")).toBe("uk_unit");
		expect(defaultUnitPreference("volume", "en-US")).toBe("fl_oz_us");
		expect(defaultUnitPreference("volume", "en-GB")).toBe("ml");

		expect(resolveUnitPreference("mass", null, "en-US")).toBe("lb");
		expect(resolveUnitPreference("mass", "kg", "en-US")).toBe("kg");
		expect(resolveUnitPreference("mass", "future-mass-unit", "en-US")).toBe(
			"kg",
		);
		expect(resolveUnitPreference("height", "ft", "fr-FR")).toBe("ft");
		expect(resolveUnitPreference("height", "in", "en-US")).toBe("cm");
		expect(resolveUnitPreference("length", "ft", "en-GB")).toBe("cm");
	});

	it("keeps caffeine and energy fixed while alcohol uses its preference", () => {
		for (const [slug, expectedUnit] of [
			["caffeine_intake", "mg"],
			["energy_intake", "kcal"],
			["alcohol_intake", "us_standard_drink"],
		] as const) {
			const resolved = resolveMetric(slug);
			if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
				throw new Error(`Expected measurement metric ${slug}.`);
			}
			expect(metricDisplayUnit(resolved.metric, new Map(), "en-US")).toBe(
				expectedUnit,
			);
		}
	});

	it("keeps every preference choice usable at its physical dimension", () => {
		for (const preference of UNIT_PREFERENCE_DIMENSIONS) {
			const dimension = DIMENSION_BY_UNIT_PREFERENCE[preference];
			for (const unit of DISPLAY_UNITS_BY_PREFERENCE_DIMENSION[preference]) {
				expect(isDisplayUnitForDimension(dimension, unit)).toBe(true);
			}
		}
	});

	it("round-trips a compound unit through its two entry fields", () => {
		const weight = measurementEntryOf(78, "mass", "st");
		expect(weight).toEqual({ major: "12", minor: "4" });
		expect(
			canonicalValueOf(parseMeasurementEntry(weight, "mass", "st")),
		).toBeCloseTo(172 * KILOGRAMS_PER_POUND, 12);

		const height = measurementEntryOf(1.8, "length", "ft");
		expect(height).toEqual({ major: "5", minor: "11" });
		expect(
			formatMeasurement(
				canonicalValueOf(parseMeasurementEntry(height, "length", "ft")),
				"length",
				"ft",
			),
		).toBe("5 ft 11 in");
	});

	it("gives a simple unit one entry field at its display resolution", () => {
		expect(measurementEntryOf(0.8, "length", "cm")).toEqual({
			major: "80.0",
			minor: "",
		});
		expect(
			canonicalValueOf(
				parseMeasurementEntry({ major: "80", minor: "" }, "length", "cm"),
			),
		).toBeCloseTo(0.8, 12);
	});

	it("reads a blank remainder as zero and rejects one that overflows", () => {
		expect(
			canonicalValueOf(
				parseMeasurementEntry({ major: "12", minor: "" }, "mass", "st"),
			),
		).toBeCloseTo(168 * KILOGRAMS_PER_POUND, 12);

		for (const entry of [
			{ major: "12", minor: "14" },
			{ major: "12.5", minor: "4" },
			{ major: "", minor: "4" },
			{ major: "nope", minor: "4" },
		]) {
			expect(parseMeasurementEntry(entry, "mass", "st")).toEqual({
				ok: false,
				error: INVALID_MEASUREMENT_MESSAGE,
			});
		}
		expect(
			parseMeasurementEntry({ major: "5", minor: "12" }, "length", "ft").ok,
		).toBe(false);
	});

	it("names the units that are entered as two parts", () => {
		expect(isCompoundDisplayUnit("st")).toBe(true);
		expect(isCompoundDisplayUnit("ft")).toBe(true);
		expect(isCompoundDisplayUnit("kg")).toBe(false);
		expect(isCompoundDisplayUnit("in")).toBe(false);
	});

	it("lets a length metric opt into the independent height preference", () => {
		const resolved = resolveMetric("waist");
		if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
			throw new Error("Expected the waist measurement metric.");
		}
		const preferences = new Map([
			["height", "ft"],
			["length", "cm"],
		]);

		expect(metricDisplayUnit(resolved.metric, preferences, "en-GB")).toBe("cm");
		expect(
			metricDisplayUnit(
				{ ...resolved.metric, unitPreferenceDimension: "height" },
				preferences,
				"en-GB",
			),
		).toBe("ft");
	});

	it("rejects non-finite and negative conversion values", () => {
		expect(() => toCanonical(Number.NaN, "mass", "kg")).toThrow(
			"finite and non-negative",
		);
		expect(() => fromCanonical(-1, "length", "cm")).toThrow(
			"finite and non-negative",
		);
	});
});
