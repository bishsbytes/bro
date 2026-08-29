import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_NAMESPACE, resources } from "./locales";
import { pseudoLocalise } from "./pseudo";
import {
	FALLBACK_LANGUAGE,
	resolveLanguage,
	SUPPORTED_LANGUAGES,
} from "./resolve-language";

/**
 * BCP-47 tag for the pseudo-locale, matching what Android and Chrome use for
 * theirs. Set EXPO_PUBLIC_PSEUDO_LOCALE=1 to start the app in it.
 */
export const PSEUDO_LANGUAGE = "en-XA";

export function pseudoLocaleEnabled(): boolean {
	return process.env.EXPO_PUBLIC_PSEUDO_LOCALE === "1";
}

function devicePreferredLanguages(): string[] {
	try {
		return getLocales().map((locale) => locale.languageTag);
	} catch {
		// Reading the device locale is best effort. A missing native module
		// should leave the app in the fallback language, not fail startup.
		return [];
	}
}

const pseudo = pseudoLocaleEnabled();

if (!i18n.isInitialized) {
	void i18n.use(initReactI18next).init({
		resources: pseudo
			? { ...resources, [PSEUDO_LANGUAGE]: pseudoLocalise(resources.en) }
			: resources,
		lng: pseudo ? PSEUDO_LANGUAGE : resolveLanguage(devicePreferredLanguages()),
		// English backs the pseudo-locale too: anything it cannot find falls
		// through unaccented, which is itself the signal that a key is missing.
		fallbackLng: FALLBACK_LANGUAGE,
		supportedLngs: pseudo
			? [...SUPPORTED_LANGUAGES, PSEUDO_LANGUAGE]
			: [...SUPPORTED_LANGUAGES],
		defaultNS: DEFAULT_NAMESPACE,
		// Resources are bundled, so there is nothing to fetch: initialise on this
		// tick instead of a later one, and the first render reads real copy rather
		// than raw keys.
		initAsync: false,
		// React escapes what it renders; escaping here as well would double it.
		interpolation: { escapeValue: false },
		react: { useSuspense: false },
	});
}

export {
	FALLBACK_LANGUAGE,
	nonBreaking,
	resolveLanguage,
	SUPPORTED_LANGUAGES,
	type SupportedLanguage,
} from "./resolve-language";
export { i18n };
