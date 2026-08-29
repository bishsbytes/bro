export const review = {
	/** A wheel score against its scale, e.g. "6/10". */
	scoreOutOf: "{{value}}/10",
	/** Stands in for a score the person has not chosen yet. */
	scoreUnset: "—",
	backToReviews: "Back to reviews",
	goals: {
		title: "Goals",
		/**
		 * Eyebrows render in capitals as a typographic convention, and the
		 * heading's letter spacing is tuned for it. Languages that do not case
		 * this way should use their natural form.
		 */
		eyebrow: "WHAT YOU'RE WORKING ON",
		status: {
			active: "Active",
			achieved: "Achieved",
			abandoned: "Stopped",
		},
		/** Joins the three fragments below. Reorder them freely per language. */
		summary: "{{start}} · {{current}} · {{target}}",
		startValue: "Started at {{value}}",
		startValueUnknown: "No starting value",
		currentValue: "Latest {{value}}",
		currentValueUnknown: "No current value",
		targetValue: "Target {{value}}",
		targetDate: "Target date {{date}}",
		targetReached: "Target reached — mark it achieved?",
		percentComplete: "{{percent}}% of the way",
		/** {{goal}} is the goal's own label, e.g. "Work & career". */
		achieve: "Mark {{goal}} achieved",
		abandon: "Stop {{goal}} goal",
	},
	history: {
		title: "Review history",
		eyebrow: "WHEEL OF LIFE",
		takeStock: "Take stock",
		loadFailed: "Reviews could not be loaded",
		emptyTitle: "No reviews yet",
		emptyBody: "Rate the areas of your life to see where things stand today.",
		open: "Open review {{date}}",
		lifeAreas_one: "{{count}} life area",
		lifeAreas_other: "{{count}} life areas",
	},
	sitting: {
		startFailed: "The wheel could not be started",
		/** Shown under every area's scale so a 1 and a 10 mean the same thing. */
		scoreHint: "1 is as low as it gets, 10 is as good as it gets.",
		/** {{score}} is already formatted against its scale, e.g. "6/10". */
		previousScore: "Last time {{score}}",
		/** Reached from the focus step, to correct one area without walking back. */
		changeAreaScore: "Change {{area}} score",
		discardTitle: "Discard this review?",
		discardBody_one: "Your {{count}} score has not been saved.",
		discardBody_other: "Your {{count}} scores have not been saved.",
		discard: "Discard",
		keepGoing: "Keep going",
		nav: {
			back: "Back",
			backA11y: "Previous area",
			close: "Close",
			closeA11y: "Close review",
			/** Jumps to the focus step once every area carries a score. */
			finish: "Focus",
			position: "{{current}} of {{total}}",
		},
		chooseFocus: "Choose focus areas",
		notSavedYet: "Nothing is saved until you finish.",
		focusTitle: "Choose your focus",
		focusIntro:
			"Pick up to three areas to work on next. You can also save without choosing one.",
		focusCount: "{{selected}}/{{max}} selected",
		focusOn: "Focus on {{area}}",
		focusLimit: "Choose up to three focus areas.",
		save: "Save review",
		changeScores: "Change scores",
	},
	goal: {
		notFound: "Focus area not found",
		notFoundBody: "This area is not part of the saved review focus.",
		currentScore: "Your current wheel score is {{score}}.",
		targetScore: "Target score",
		targetScorePlaceholder: "1–10",
		targetDate: "Target date (optional)",
		/** Shown in the empty field; mirrors the format the input accepts. */
		targetDatePlaceholder: "YYYY-MM-DD",
		save: "Save goal",
		progressNote:
			"Progress comes from future wheel scores; there is nothing extra to log.",
	},
	result: {
		notFound: "Review not found",
		notFoundBody: "This review is no longer on this device.",
		title: "Your wheel",
		completed: "Completed {{date}}",
		lifeAreas: "Life areas",
		comparedWithPrevious: "Compared with your previous review",
		focus: "Focus",
		noChange: "No change",
		/** {{delta}} is already signed, e.g. "+2 from 6". */
		delta: "{{delta}} from {{previous}}",
		previousLabel: "Previously “{{label}}”",
		notPreviouslyRated: "Not rated in your previous review",
		setGoal: "Set a goal for {{area}}",
		readChallenge: "Read “{{title}}”",
		addHabit: "Add habit “{{label}}”",
		firstSnapshot:
			"This is your first snapshot. Your next review will show what moved.",
		takeStockAgain: "Take stock again",
	},
} as const;
