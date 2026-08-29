import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_NAMESPACE, resources } from "./locales";
import {
	FALLBACK_LANGUAGE,
	resolveLanguage,
	SUPPORTED_LANGUAGES,
} from "./resolve-language";

function devicePreferredLanguages(): string[] {
	try {
		return getLocales().map((locale) => locale.languageTag);
	} catch {
		// Reading the device locale is best effort. A missing native module
		// should leave the app in the fallback language, not fail startup.
		return [];
	}
}

if (!i18n.isInitialized) {
	void i18n.use(initReactI18next).init({
		resources,
		lng: resolveLanguage(devicePreferredLanguages()),
		fallbackLng: FALLBACK_LANGUAGE,
		supportedLngs: [...SUPPORTED_LANGUAGES],
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
