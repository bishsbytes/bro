import {
	CANONICAL_STORAGE_UNITS,
	defaultDisplayUnit,
	DISPLAY_RESOLUTIONS,
	DISPLAY_UNITS_BY_DIMENSION,
	formatMeasurement,
	fromCanonical,
	INVALID_MEASUREMENT_MESSAGE,
	KILOGRAMS_PER_POUND,
	METRES_PER_INCH,
	parseMeasurement,
	resolveDisplayUnit,
	toCanonical,
} from ".";

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
		});
		expect(DISPLAY_UNITS_BY_DIMENSION).toEqual({
			mass: ["kg", "lb", "st"],
			length: ["cm", "in"],
			fraction: ["%"],
		});
		expect(DISPLAY_RESOLUTIONS).toEqual({
			kg: 0.1,
			lb: 0.2,
			st: 1,
			cm: 0.5,
			in: 0.25,
			"%": 0.1,
		});
	});

	it("uses exact mass and length definitions", () => {
		expect(toCanonical(1, "mass", "lb")).toBe(KILOGRAMS_PER_POUND);
		expect(toCanonical(1, "length", "in")).toBe(METRES_PER_INCH);
		expect(fromCanonical(KILOGRAMS_PER_POUND, "mass", "lb")).toBe(1);
		expect(fromCanonical(METRES_PER_INCH, "length", "in")).toBe(1);
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
		["-1", "length", "cm"],
		["101%", "fraction", "%"],
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
		expect(formatMeasurement(0.1846, "fraction", "%")).toBe("18.5%");
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
		expect(defaultDisplayUnit("mass", "en-US")).toBe("lb");
		expect(defaultDisplayUnit("length", "en-US")).toBe("in");
		expect(defaultDisplayUnit("mass", "en-GB")).toBe("st");
		expect(defaultDisplayUnit("length", "en-GB")).toBe("cm");
		expect(defaultDisplayUnit("mass", "fr-FR")).toBe("kg");
		expect(defaultDisplayUnit("length", "fr-FR")).toBe("cm");
		expect(defaultDisplayUnit("fraction", "en-US")).toBe("%");

		expect(resolveDisplayUnit("mass", null, "en-US")).toBe("lb");
		expect(resolveDisplayUnit("mass", "kg", "en-US")).toBe("kg");
		expect(resolveDisplayUnit("mass", "future-mass-unit", "en-US")).toBe("kg");
		expect(resolveDisplayUnit("length", "future-length-unit", "en-US")).toBe(
			"cm",
		);
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
