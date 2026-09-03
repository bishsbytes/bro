import { type Href, router } from "expo-router";

/**
 * Leaves the log screen for the Intake tab, opened on the day just logged and
 * showing what is on it rather than the day's totals.
 *
 * The tab is already on the stack below, so the log screen is dismissed onto
 * it. Pushing a day of its own would strand the finished log screen underneath
 * a second copy of the tab's own card.
 */
export function showLoggedIntakeDay(localDay: string) {
	const href = `/intake?day=${localDay}&view=logged` as Href;

	if (router.canDismiss()) {
		router.dismissTo(href);
		return;
	}

	// Opened directly, by deep link rather than from a tab.
	router.replace(href);
}
