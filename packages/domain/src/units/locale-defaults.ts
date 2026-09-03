import {
	type DisplayUnitForPreferenceDimension,
	FALLBACK_DISPLAY_UNITS_BY_PREFERENCE_DIMENSION,
	isDisplayUnitForPreferenceDimension,
	type UnitPreferenceDimension,
} from "./dimensions";

/**
 * The locale this device is formatting in, or undefined where the environment
 * cannot say. Callers treat undefined as "use the fallback for the dimension"
 * rather than guessing a region.
 */
export function systemLocale(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().locale;
	} catch {
		return undefined;
	}
}

function regionFromLocale(locale: string | undefined): string | null {
	if (!locale?.trim()) return null;
	const normalized = locale.trim().replaceAll("_", "-");

	try {
		const region = new Intl.Locale(normalized).region;
		if (region) return region.toUpperCase();
	} catch {
		// Fall through to the deliberately small BCP-47 parser below.
	}

	for (const part of normalized.split("-").slice(1)) {
		if (/^[A-Za-z]{2}$/.test(part) || /^\d{3}$/.test(part)) {
			return part.toUpperCase();
		}
	}
	return null;
}

export function defaultUnitPreference<D extends UnitPreferenceDimension>(
	dimension: D,
	locale?: string,
): DisplayUnitForPreferenceDimension<D> {
	const region = regionFromLocale(locale);
	if (dimension === "mass") {
		return (
			region === "US" ? "lb" : region === "GB" ? "st" : "kg"
		) as DisplayUnitForPreferenceDimension<D>;
	}
	if (dimension === "height") {
		return (
			region === "US" || region === "GB" ? "ft" : "cm"
		) as DisplayUnitForPreferenceDimension<D>;
	}
	if (dimension === "length") {
		return (
			region === "US" ? "in" : "cm"
		) as DisplayUnitForPreferenceDimension<D>;
	}
	if (dimension === "alcohol") {
		return (
			region === "US" ? "us_standard_drink" : "uk_unit"
		) as DisplayUnitForPreferenceDimension<D>;
	}
	if (dimension === "volume") {
		return (
			region === "US" ? "fl_oz_us" : "ml"
		) as DisplayUnitForPreferenceDimension<D>;
	}
	if (dimension === "sodium") {
		// UK labels declare salt; most others declare sodium.
		return (
			region === "GB" ? "salt_g" : "mg"
		) as DisplayUnitForPreferenceDimension<D>;
	}
	return "%" as DisplayUnitForPreferenceDimension<D>;
}

/**
 * Missing preferences follow the locale. Unknown future values deliberately do
 * not: they fall back to today's safe display unit instead of changing with the
 * device region or throwing during render.
 */
export function resolveUnitPreference<D extends UnitPreferenceDimension>(
	dimension: D,
	storedUnit: string | null | undefined,
	locale?: string,
): DisplayUnitForPreferenceDimension<D> {
	if (storedUnit === null || storedUnit === undefined) {
		return defaultUnitPreference(dimension, locale);
	}
	if (isDisplayUnitForPreferenceDimension(dimension, storedUnit)) {
		return storedUnit;
	}
	return FALLBACK_DISPLAY_UNITS_BY_PREFERENCE_DIMENSION[dimension];
}
