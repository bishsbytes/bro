export const home = {
	loadFailed: "Today could not be loaded",
	checkIns: {
		title: "Check-ins",
		count_one: "{{count}} check-in",
		count_other: "{{count}} check-ins",
		review: "Review check-ins",
		hide: "Hide check-ins",
		promptFirst: "How's today?",
		promptAgain: "Check in again",
		moodPrefix: "Mood",
		last: "Last check-in {{summary}}",
		hintWithOptional: "Tap a face to start — the rest takes seconds.",
		hint: "Tap a face to check in.",
		edit: "Edit",
		editA11y: "Edit check-in {{summary}}",
		none: "No check-in was logged.",
	},
	tags: {
		title: "What happened",
		hint: "Tap anything that applied today.",
	},
	note: {
		title: "Note",
		field: "Note (optional)",
		placeholder: "Anything worth remembering?",
		save: "Save note",
	},
	measurements: {
		title: "Measurements",
		/** Shown when a measurement matched the previous day exactly. */
		unchangedBadge: "— 0%",
		/** {{arrow}} is ↑ or ↓ and {{amount}} a percentage or formatted delta. */
		changeBadge: "{{arrow}} {{amount}}",
		unchanged: "Same as previous day",
		higher: "{{delta}} higher than previous day",
		lower: "{{delta}} lower than previous day",
	},
	notes: {
		title: "Notes",
	},
	habits: {
		title: "Habits",
		manage: "Manage",
		doneToday: "Done today",
		stillToDo: "Still to do",
		doneOnDay: "Done on this day",
		notDone: "Not done",
		/**
		 * Appends the run of consecutive completed days to the status above.
		 * "day streak" is a fixed idiom here and does not inflect with the count.
		 */
		withStreak: "{{status}} · {{days}} day streak",
		undo: "Undo",
		markDone: "Mark done",
		emptyTitle: "Build a routine",
		emptyBody: "Add a habit and Today will keep the next small action in view.",
		choose: "Choose a habit",
	},
	challenges: {
		title: "Challenges",
		/** Renders in capitals; see the note on eyebrows in the review catalogue. */
		dayOf: "DAY {{day}} OF {{total}}",
		markStepDone: "Mark step done",
		view: "View challenge",
		completeTitle: "Challenge complete",
		completeBody: "You finished {{name}}.",
		dismiss: "Dismiss",
	},
	wheel: {
		title: "Take stock of the bigger picture",
		body: "Rate the areas of your life and choose where to focus next.",
		takeStock: "Take stock",
		statusFailed: "Wheel review status could not be loaded: {{error}}",
	},
	pastDay: {
		edit: "Edit this day",
	},
} as const;
