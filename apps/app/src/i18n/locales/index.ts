import { content } from "./content";
import { auth } from "./en/auth";
import { body } from "./en/body";
import { challenges } from "./en/challenges";
import { checkIn } from "./en/checkIn";
import { common } from "./en/common";
import { drinks } from "./en/drinks";
import { food } from "./en/food";
import { habits } from "./en/habits";
import { history } from "./en/history";
import { home } from "./en/home";
import { insights } from "./en/insights";
import { life } from "./en/life";
import { log } from "./en/log";
import { navigation } from "./en/navigation";
import { nicotine } from "./en/nicotine";
import { notifications } from "./en/notifications";
import { onboarding } from "./en/onboarding";
import { privacy } from "./en/privacy";
import { review } from "./en/review";
import { settings } from "./en/settings";
import { validation } from "./en/validation";

/**
 * Every catalogue ships in the bundle, so i18next initialises synchronously and
 * the first render already has its copy. Add a namespace here and it becomes
 * part of the key types in `i18next.d.ts` automatically.
 *
 * These do not cover the iOS permission prompts. Those strings are read by the
 * system before any JavaScript runs, so they live in `apps/app/locales/<lang>.json`
 * and are wired up through the `locales` key in `app.json`.
 */
export const resources = {
	en: {
		auth,
		body,
		challenges,
		checkIn,
		common,
		content,
		drinks,
		food,
		habits,
		history,
		home,
		insights,
		life,
		log,
		navigation,
		nicotine,
		notifications,
		onboarding,
		privacy,
		review,
		settings,
		validation,
	},
} as const;

export const DEFAULT_NAMESPACE = "common";
