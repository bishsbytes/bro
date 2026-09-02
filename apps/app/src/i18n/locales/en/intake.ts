/**
 * Copy for the intake tab: food, drink, and anything else taken in. The tab
 * names the act, not the substance, so a stream switched on later needs a row
 * here rather than a vocabulary of its own.
 */
export const intake = {
	intro: "Everything you took in today, in one place.",
	loadFailed: "Today's intake could not be loaded",
	loadFailedBody: "Try again.",
	today: "Today",
	drinks: "Drinks",
	food: "Food",
	nicotine: "Smoking & vaping",
	entries_one: "{{count}} entry",
	entries_other: "{{count}} entries",
	/** {{name}} is a section name. */
	open: "Open {{name}}",
} as const;
