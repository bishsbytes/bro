import type { HealthPlatform } from "@bro/database-app";

/**
 * The display name for a health platform, as a product name.
 *
 * Apple Health and Health Connect are product names and stay untranslated,
 * which is the part every caller agrees on. It takes a bare `string` so it can
 * be handed the raw `source` recorded against an observation without narrowing
 * first, and returns `null` for anything else — a person's own entry, or a
 * source this build does not recognise. Callers word that case differently:
 * the observation lists say "You", settings falls back to its own section
 * title, and the history day screen shows the raw source it was given.
 *
 * Every `HealthPlatform` has a label, so passing one back is narrowed to
 * `string` and needs no fallback of its own.
 */
export function healthPlatformLabel(platform: HealthPlatform): string;
export function healthPlatformLabel(source: string | null): string | null;
export function healthPlatformLabel(source: string | null): string | null {
	if (source === "healthkit") {
		return "Apple Health";
	}
	if (source === "health_connect") {
		return "Health Connect";
	}
	return null;
}
