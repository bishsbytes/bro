/**
 * Messages thrown by the stores. Screens render `caught.message` directly, so
 * these reach people and belong in a catalogue like any other copy.
 *
 * The `_drink` / `_food` pairs are i18next contexts rather than one message
 * with a `{{noun}}` placeholder: a sentence built by dropping a subject into a
 * slot only works while the subject needs no article, gender, or case.
 */
export const validation = {
	/** {{field}} names the input, e.g. "Drink volume". */
	nonNegativeNumber: "{{field}} must be empty or a non-negative number.",
	fields: {
		drinkVolume: "Drink volume",
		drinkCaffeine: "Drink caffeine",
		drinkEnergy: "Drink energy",
		drinkAbv: "Drink ABV",
		foodEnergy: "Food energy",
		foodProtein: "Food protein",
		foodCarbs: "Food carbohydrate",
		foodFat: "Food fat",
	},
	consumption: {
		quantityPositive_drink: "Drink quantity must be a positive number.",
		quantityPositive_food: "Food quantity must be a positive number.",
		entryNotFound_drink: "Drink entry not found.",
		entryNotFound_food: "Food entry not found.",
		customNotFound_drink: "Custom drink not found.",
		customNotFound_food: "Custom food not found.",
		chooseCustom_drink: "Choose a custom drink and serving.",
		chooseCustom_food: "Choose a custom food and serving.",
		recentNotFound_drink: "Recent drink not found.",
		recentNotFound_food: "Recent food not found.",
		logBeforeGoal_drink: "Log drink before setting a goal.",
		logBeforeGoal_food: "Log food before setting a goal.",
		unknownMetric_drink: "Unknown drink metric: {{slug}}",
		unknownMetric_food: "Unknown food metric: {{slug}}",
		targetSameAsLatest: "Choose a target different from your latest total.",
		activeGoalExists: "Finish the active goal before creating another.",
	},
	drinks: {
		chooseCatalogue: "Choose a drink and serving from the catalogue.",
		abvMaximum: "Drink ABV must not exceed 100%.",
		volumeWithAbv: "Enter a volume when entering an ABV.",
	},
	food: {
		chooseSearched: "Choose a searched food and serving.",
		onlyRecipes: "Only recipes can have components.",
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
