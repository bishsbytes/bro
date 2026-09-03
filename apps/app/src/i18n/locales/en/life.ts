export const life = {
	loadFailed: "Your life view could not be loaded",
	loadFailedBody: "Try again.",
	intro:
		"See where life stands, what you are focusing on, and the practices that move it forward.",
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
		/** A wheel score against its scale, e.g. "6/10". */
		scoreOutOf: "{{value}}/10",
	},
	goals: {
		title: "Headings",
		eyebrow: "Your direction",
		statusActive: "Active",
		statusAchieved: "Archived",
		statusAbandoned: "Removed",
		/** Joins the two fragments below; reorder freely per language. */
		summary: "{{current}} · {{target}}",
		currentValue: "Latest {{value}}",
		currentValueUnknown: "No current value",
		targetValue: "Heading {{value}}",
		percentComplete: "",
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
