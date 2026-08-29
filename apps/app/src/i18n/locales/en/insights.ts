export const insights = {
	intro:
		"See the patterns in your record and how every tracked measure changes over time.",
	patterns: {
		title: "Insights",
		/** Renders in capitals; see the note on eyebrows in the review catalogue. */
		eyebrow: "LAST 90 DAYS",
		loadFailed: "Insights could not be loaded",
		emptyTitle: "Your patterns start with check-ins",
		emptyBody:
			"As your record grows, this space compares days to show associations that you did not have to type in yourself.",
		watchingTitle_one: "Watching {{count}} pattern",
		watchingTitle_other: "Watching {{count}} patterns",
		rowTitle: "Pattern in your record",
		open: "Open insight: {{summary}}",
	},
	detail: {
		loadFailed: "Insight could not be loaded",
		goneTitle: "This pattern is no longer showing",
		goneBody:
			"Insights change with your record and disappear when the evidence no longer supports them.",
		title: "What your record shows",
		days_one: "{{count}} day",
		days_other: "{{count}} days",
		noteTitle: "A note on this pattern",
		noteBody:
			"This is an association in your own record. It does not show that one thing caused the other, and it is not advice.",
	},
	trends: {
		title: "Trends",
		/** Renders in capitals; see the note on eyebrows in the review catalogue. */
		eyebrow: "YOUR TRACKED DATA",
		intro:
			"Scored metrics use daily averages, body metrics use the last reading, and consumption totals are summed. Missing days stay as gaps.",
		loadFailed: "Trends could not be loaded",
		period_one: "{{count}} day",
		period_other: "{{count}} days",
		/** Both are local days bounding the charted window. */
		range: "{{from}} to {{through}}",
		loggedDays_one: "{{count}} logged day",
		loggedDays_other: "{{count}} logged days",
		latest: "Latest {{value}}",
		notEnoughData_one:
			"Not enough data yet. Log {{count}} more day to make this trend useful.",
		notEnoughData_other:
			"Not enough data yet. Log {{count}} more days to make this trend useful.",
		enoughData: "Enough data for a first trend.",
	},
	history: {
		title: "History",
		detail: "Browse check-ins and reviews by day.",
		open: "Open history",
	},
} as const;
