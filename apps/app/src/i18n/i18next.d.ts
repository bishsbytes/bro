import type { DEFAULT_NAMESPACE, resources } from "./locales";

/**
 * Makes every `t("…")` call a checked key rather than a free string, so a typo
 * or a key deleted from a catalogue fails `nx typecheck` instead of rendering
 * itself to a user.
 */
declare module "i18next" {
	interface CustomTypeOptions {
		defaultNS: typeof DEFAULT_NAMESPACE;
		resources: (typeof resources)["en"];
	}
}
