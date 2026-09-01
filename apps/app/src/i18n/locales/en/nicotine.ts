/**
 * Copy for the nicotine log. The register is deliberately flat: this surface
 * exists for men trying to cut down or stop, and every logged entry is data,
 * not a confession. No thresholds, no "heavy", no guideline comparison, and
 * nothing that makes logging a lapse feel worse than not logging it — a log
 * that shames its user stops being kept in the week it matters most.
 */
export const nicotine = {
	loadFailed: "Smoking log could not be loaded",
	loadFailedBody: "Try again.",
	title: "Smoking & vaping",
	/** The word used when a serving has no name of its own. */
	defaultServing: "serving",
	/** Thrown when a catalogue pick no longer resolves. */
	chooseCatalogue: "Choose an item and serving.",
	amountInvalid: "Nicotine must be zero or more.",
	today: {
		title: "Today",
		/** {{value}} is the seven-day total for the metric above it. */
		weekTotal: "7 days {{value}}",
		disclaimer:
			"Amounts are estimates from what you logged, not a measurement of what you absorbed.",
	},
	overview: {
		manageTitle: "Manage",
		goals: "Daily goals",
		goalsDetail: "Review or change your daily nicotine goal.",
	},
	quickAdd: {
		title: "Quick add",
		/** Renders in capitals; see the note on eyebrows in the review catalogue. */
		eyebrow: "RECENT",
		empty: "What you log most will appear here.",
		/** An item and the serving it was logged in. */
		option: "{{item}} · {{serving}}",
		added: "{{item}} added",
	},
	browse: {
		headerPlaceholder: "What did you have?",
		fieldA11y: "Search smoking and vaping",
		clearA11y: "Clear search",
		recentTitle: "Recent",
		logRecentA11y: "Log {{name}} again",
		catalogueTitle: "Browse",
		searchResultsTitle: "Search results",
		empty: "Nothing matches that.",
		freeTitle: "Something else",
		freeDetail: "Log an item that is not listed.",
	},
	free: {
		title: "Something else",
		label: "What was it?",
		labelPlaceholder: "e.g. cigarillo",
		servingLabel: "Serving (optional)",
		amount: "Nicotine per item (mg)",
		amountHint: "An estimate is fine — it only needs to be consistent.",
		save: "Log it",
	},
	entry: {
		edit: "Edit entry",
		delete: "Delete entry",
		deleteConfirm: "Delete this entry?",
		deleteConfirmBody: "It will be removed from the day's total.",
		quantity: "How many?",
		time: "Time",
		save: "Save",
	},
	day: {
		empty: "Nothing logged for this day.",
		emptyBody: "Anything you log for this day will appear here.",
		total: "Day total",
	},
	goals: {
		/** States the target and where the day stands, without grading either. */
		summary: "Target {{target}} · today {{current}}",
		targetReached: "You are at or under your target.",
		percentComplete: "{{percent}}% of the way there",
		targetField: "Daily target ({{unit}})",
		targetDateField: "By (optional)",
		save: "Set target",
		setFor: "Set a target for {{name}}",
		achieve: "Mark as done",
		abandon: "Stop this goal",
		needsLog: "Log something first, so a target has somewhere to start.",
	},
	settings: {
		title: "Smoking & vaping",
		trackTitle: "Track smoking and vaping",
		trackDetail:
			"Adds a log for cigarettes and vapes, and a nicotine total to your trends.",
		off: "Off",
		on: "On",
	},
} as const;
