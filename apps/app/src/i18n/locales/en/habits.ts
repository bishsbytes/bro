export const habits = {
	loadFailed: "Habits could not be loaded",
	loadFailedBody: "Try again.",
	intro:
		"Choose the days that matter. Unscheduled days never count against a streak.",
	editor: {
		addTitle: "Add habit",
		addCustomTitle: "Add your own",
		editTitle: "Edit habit",
		nameField: "Habit name",
		targetField: "Daily target",
		areaField: "Life area",
		areaOption: "Life area {{name}}",
		scheduledDays: "Scheduled days",
		save: "Save habit",
		cancel: "Cancel",
		needName: "Give this habit a name.",
		needDay: "Choose at least one day.",
		needTarget: "Enter a valid target.",
	},
	list: {
		title: "Your habits",
		empty: "No habits yet.",
		kindAutomatic: "Automatic",
		kindManual: "Tap to complete",
		/** Joins the habit's kind with its life area. */
		meta: "{{kind}} · {{area}}",
		edit: "Edit",
		moveUp: "Move up",
		moveUpA11y: "Move {{name}} up",
		moveDown: "Move down",
		moveDownA11y: "Move {{name}} down",
		viewRecord: "View 8-week record",
		remove: "Remove habit",
		addCustom: "Add your own",
	},
	catalogue: {
		more: "More",
		add: "Add",
		addA11y: "Add {{name}}",
	},
	detail: {
		loadFailed: "Habit record could not be loaded",
		notFound: "Habit not found",
		notFoundBody: "This habit is no longer available.",
		/** Renders in capitals; see the note on eyebrows in the review catalogue. */
		eyebrow: "LAST 8 WEEKS",
		intro:
			"A descriptive record of scheduled days. Missing metric data is kept separate from a missed habit.",
		/** Screen-reader label for one day in the grid. */
		daySummary: "{{day}}: {{state}}",
		stateDone: "Done",
		stateMissed: "Missed",
		stateUnscheduled: "Unscheduled",
		stateNoData: "No data",
	},
} as const;
