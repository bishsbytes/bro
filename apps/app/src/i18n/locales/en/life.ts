export const life = {
	loadFailed: "Your life view could not be loaded",
	loadFailedBody: "Try again.",
	wheel: {
		title: "Your wheel",
		reviewedEyebrow: "Reviewed {{date}}",
		openLatest: "Open latest review",
		manageAreas: "Manage life areas",
		emptyTitle: "Take stock of the bigger picture",
		emptyEyebrow: "Wheel of life",
		emptyBody:
			"Rate the areas of your life, choose where to focus, and create a first snapshot to come back to.",
		takeStock: "Take stock",
		dueTitle: "Time to take stock",
		dueEyebrow: "Wheel review",
		dueBody:
			"It has been more than five weeks since your last snapshot. See what has moved and choose your next focus.",
	},
	focus: {
		title: "Focus areas",
		eyebrow: "What matters now",
	},
	goals: {
		title: "Headings",
		eyebrow: "Your direction",
		status: {
			active: "Active",
			achieved: "Archived",
			abandoned: "Removed",
		},
		/** Joins the two fragments below; reorder freely per language. */
		summary: "{{current}} · {{target}}",
		currentValue: "Latest {{value}}",
		currentValueUnknown: "No current value",
		targetValue: "Heading {{value}}",
		targetDate: "By {{date}}",
		/** Stands in for the aim of a heading that carries neither target nor intent. */
		noTarget: "No target — you decide when it is done",
		percentComplete: "",
	},
	heading: {
		/** The stack header over a heading's own screen. */
		eyebrow: "Heading",
		notFound: "Heading not found",
		notFoundBody: "This heading is no longer on this device.",
		loadFailed: "This heading could not be loaded",
		add: "Add a heading",
		/** The sheet's own header, above the editorial title. */
		newEyebrow: "New heading",
		editEyebrow: "Edit heading",
		formTitle: "Set your direction.",
		nameField: "Name",
		intentField: "What are you aiming for?",
		areaField: "Life area",
		startField: "Start date",
		targetDateField: "Target date (optional)",
		noteField: "Why it matters (optional)",
		create: "Create heading",
		save: "Save changes",
		started: "Started {{date}}",
		/** Reads under the name when a heading is measured against a metric. */
		measured: "{{current}} · {{target}}",
		practiceTitle: "Your practice",
		practiceEyebrow: "What you do about it",
		practiceEmpty:
			"No practice is filed under this life area yet. Add one to make the heading something you do.",
		practiceManage: "Manage practices",
		practiceDone: "Done today",
		practiceNotDone: "Not done yet",
		practiceLast: "Last done {{date}}",
		practiceMarkDone: "Mark done",
		activityTitle: "Recent activity",
		activityEmpty: "Nothing recorded in the last four weeks.",
		edit: "Edit heading",
		archive: "Archive heading",
		/** Shown before archiving, so the scope of the action is not a surprise. */
		archiveBody:
			"Archiving keeps the heading and its history, and stops it counting as active.",
		remove: "Remove heading",
		removeBody:
			"Removing stops the heading without deleting it. It stays in your history, marked as removed.",
		reopenBody:
			"This heading is no longer active. Its history is kept as it was.",
	},
	habits: {
		title: "Habits",
		eyebrow: "What you practise",
		rowTitle: "Your habits",
		manage: "Manage habits",
		none: "No habits scheduled today",
		noRoutine: "Choose a routine to keep the next small action in view",
		/** {{total}} are scheduled for today, {{done}} of them are complete. */
		progress: "{{total}} today · {{done}} complete",
	},
	areas: {
		loadFailed: "Life areas could not be loaded",
		intro:
			"Choose which areas appear in a new wheel. Changes affect future reviews only; saved reviews keep their original labels and order.",
		defaultLabel: "Default: {{name}}",
		enable: "Enable {{name}}",
		disable: "Disable {{name}}",
		limit: "Choose up to {{max}} active life areas — disable one first.",
		moveUp: "Move up",
		moveUpA11y: "Move {{name}} up",
		moveDown: "Move down",
		moveDownA11y: "Move {{name}} down",
		labelField: "Label for {{name}}",
		saveLabel: "Save label",
		cancel: "Cancel",
		changeLabel: "Change label",
		changeLabelA11y: "Change label for {{name}}",
	},
} as const;
