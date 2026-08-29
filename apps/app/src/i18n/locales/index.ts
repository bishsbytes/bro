import { common } from "./en/common";
import { review } from "./en/review";

/**
 * Every catalogue ships in the bundle, so i18next initialises synchronously and
 * the first render already has its copy. Add a namespace here and it becomes
 * part of the key types in `i18next.d.ts` automatically.
 */
export const resources = {
	en: { common, review },
} as const;

export const DEFAULT_NAMESPACE = "common";
