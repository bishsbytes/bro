import {
	type Dimension,
	type DisplayUnitForDimension,
	FALLBACK_DISPLAY_UNITS,
	isDisplayUnitForDimension,
} from "./dimensions";

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

export function defaultDisplayUnit<D extends Dimension>(
	dimension: D,
	locale?: string,
): DisplayUnitForDimension<D> {
	const region = regionFromLocale(locale);
	if (dimension === "mass") {
		return (
			region === "US" ? "lb" : region === "GB" ? "st" : "kg"
		) as DisplayUnitForDimension<D>;
	}
	if (dimension === "length") {
		return (region === "US" ? "in" : "cm") as DisplayUnitForDimension<D>;
	}
	return "%" as DisplayUnitForDimension<D>;
}

/**
 * Missing preferences follow the locale. Unknown future values deliberately do
 * not: they fall back to today's safe display unit instead of changing with the
 * device region or throwing during render.
 */
export function resolveDisplayUnit<D extends Dimension>(
	dimension: D,
	storedUnit: string | null | undefined,
	locale?: string,
): DisplayUnitForDimension<D> {
	if (storedUnit === null || storedUnit === undefined) {
		return defaultDisplayUnit(dimension, locale);
	}
	if (isDisplayUnitForDimension(dimension, storedUnit)) {
		return storedUnit;
	}
	return FALLBACK_DISPLAY_UNITS[dimension];
}
