export const SUPPORTED_LANGUAGES = ["en"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: SupportedLanguage = "en";

/**
 * Picks the first language the device asks for that we actually ship copy in.
 * Tags arrive most-preferred first and may carry a region ("en-GB"); matching
 * on the base language keeps one catalogue serving every region that speaks it.
 */
export function resolveLanguage(
	preferred: readonly string[],
): SupportedLanguage {
	for (const tag of preferred) {
		const base = tag.trim().replaceAll("_", "-").split("-")[0]?.toLowerCase();
		const supported = SUPPORTED_LANGUAGES.find((language) => language === base);
		if (supported) {
			return supported;
		}
	}

	return FALLBACK_LANGUAGE;
}

/**
 * Replaces the spaces in a short label with non-breaking ones. Buttons that
 * wrap mid-phrase read as two separate controls, and the catalogues keep
 * ordinary spaces so no translator has to type an invisible character.
 */
export function nonBreaking(text: string): string {
	return text.replaceAll(" ", "\u00a0");
}
