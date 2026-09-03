/**
 * Messages thrown by the stores. Screens render `caught.message` directly, so
 * these reach people and belong in a catalogue like any other copy.
 *
 * Intake messages name no stream: one log serves food, drink, and every
 * optional stream, so the sentences are written to read the same for each.
 */
export const validation = {
	/** {{field}} names the input, e.g. "Energy". */
	nonNegativeNumber: "{{field}} must be empty or a non-negative number.",
	measurement: {
		invalid: "Enter a valid measurement.",
	},
	intake: {
		quantityPositive: "Quantity must be a positive number.",
		nameRequired: "Give it a name.",
		eventNotFound: "Entry not found.",
		consumableNotFound: "Item not found.",
		choosePortion: "Choose a portion.",
		chooseItem: "Choose an item.",
		recentNotFound: "Recent entry not found.",
		/** {{stream}} is a stream name, e.g. "Smoking & vaping". */
		streamOff: "Turn on {{stream}} in intake settings before logging it.",
		logBeforeGoal: "Log something before setting a goal.",
		unknownMetric: "Unknown total: {{slug}}",
		targetSameAsLatest: "Choose a target different from your latest total.",
		activeGoalExists: "Finish the active goal before creating another.",
		abvMaximum: "ABV must not exceed 100%.",
		volumeWithAbv: "Enter a volume when entering an ABV.",
		needsOneValue: "Enter at least one value.",
		ingredientsRequired: "A recipe needs at least one ingredient.",
		recipeCycle: "A recipe cannot contain itself.",
	},
	checkIn: {
		/** {{score}} is the metric's own label, e.g. "Mood". */
		scoreRange: "{{score}} must be a whole number from 1 to 5.",
	},
	body: {
		valueRange: "Measurement values must be finite and non-negative.",
		fractionRange: "Fraction measurements must be between zero and one.",
		observationNotFound: "Measurement observation not found.",
		logBeforeGoal: "Log a measurement before setting a goal.",
		targetSameAsLatest:
			"Choose a target different from your latest measurement.",
		activeGoalExists: "Finish the active goal before creating another.",
	},
	review: {
		rateEveryArea: "Rate every displayed life area before saving.",
		/** {{area}} is the life area's own label. */
		scoreRange: "{{area}} must be a whole number from 1 to 10.",
		focusLimit: "Choose no more than three unique focus areas from this wheel.",
		enableAnArea: "Enable at least one life area before taking stock.",
		goalFromFocusArea: "Goals can only be created from a saved focus area.",
		targetRange: "Choose a whole-number target from 1 to 10.",
		targetSameAsCurrent: "Choose a target different from your current score.",
	},
	habits: {
		/** A programming fault rather than something a person can cause. */
		adherenceDates: "Habit adherence range must use real YYYY-MM-DD dates.",
		adherenceForwards: "Habit adherence range must run forwards.",
		customLabelEmpty: "Custom habit label must not be empty.",
	},
} as const;
