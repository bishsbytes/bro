export const body = {
	notFound: "Measurement not found",
	notFoundBody: "This measurement is not available.",
	backToBody: "Back to Body",
	/** Renders in capitals; see the note on eyebrows in the review catalogue. */
	latestEyebrow: "LATEST",
	noneLoggedPrompt: "Log this measurement from your daily check-in.",
	noneImported: "No imported measurements yet.",
	/** {{when}} is a date and time, {{source}} names where the reading came from. */
	latestWithSource: "{{when}} · Source: {{source}}",
	readOnly:
		"Imported measurements are read-only in bro. Manage access in your health platform settings.",
	sourceYou: "You",
	goal: {
		title: "Goal",
		target: "Target {{value}}",
		/** Joins the two fragments below; reorder freely per language. */
		summary: "{{start}} · {{current}}",
		startValue: "Started at {{value}}",
		startValueUnknown: "No starting measurement",
		currentValue: "Latest {{value}}",
		currentValueUnknown: "No current measurement",
		targetDate: "Target date {{date}}",
		targetReached: "Target reached — mark it achieved?",
		percentComplete: "{{percent}}% of the way",
		achieve: "Mark goal achieved",
		abandon: "Stop goal",
		targetField: "Target",
		targetDateField: "Target date (optional)",
		/** Shown in the empty field; mirrors the format the input accepts. */
		targetDatePlaceholder: "YYYY-MM-DD",
		save: "Save goal",
		needMeasurement: "Log a measurement before setting a goal.",
		statusAchieved: "Achieved",
		statusAbandoned: "Stopped",
		/** {{status}} is one of the two labels above. */
		pastGoal: "{{status}}: target {{value}}",
	},
	history: {
		title: "History",
		empty: "No measurements logged yet.",
		valueField: "Value",
		/** {{id}} disambiguates rows for screen readers; it is not shown. */
		editA11y: "Edit {{name}} {{id}}",
		source: "Source: {{source}}",
		save: "Save measurement",
		saveA11y: "Save measurement {{id}}",
		delete: "Delete measurement",
		deleteA11y: "Delete measurement {{id}}",
		usedForDay: "Used for this day's value",
	},
} as const;
