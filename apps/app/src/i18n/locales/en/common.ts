/**
 * Copy shared across features. Wording used by two or more screens belongs
 * here; anything one screen owns stays in that feature's catalogue.
 */
export const common = {
	actions: {
		tryAgain: "Try again",
		viewLog: "View log",
	},
	datePicker: {
		chooseDate: "Choose date",
		openHint: "Opens the date picker",
		noDateSelected: "No date selected",
		clearDate: "Clear date",
		cancel: "Cancel",
		done: "Done",
	},
	ratingEnds: {
		veryBad: "Very bad",
		veryLow: "Very low",
		veryGood: "Very good",
	},
	/** Stands in for a value that has not been recorded. */
	emDash: "—",
	/** Shown when the local database cannot be opened at startup. */
	storage: {
		unavailable: "Local storage is unavailable",
	},
	/** Screen-reader labels for the shared components. */
	a11y: {
		settings: "Settings",
		wheelChart: "Wheel of life chart",
		/** Legend entries on the wheel chart. */
		wheelThisReview: "This review",
		wheelPreviousReview: "Previous review",
		trendChart: "{{metric}} trend chart",
		/** One score button, e.g. "Mood 4". */
		score: "{{prefix}} {{score}}",
		/** One adjustable score rail, e.g. "Work & career score". */
		scale: "{{prefix}} score",
		weekOf: "Week of {{date}}",
		checkInLogged: "check-in logged",
		noCheckIn: "no check-in",
		noHabitsScheduled: "no habits scheduled",
		habitsDone: "{{done}} of {{scheduled}} habits done",
		/** The day, then its check-in state, then its habit progress. */
		daySummary: "{{day}}, {{checkIn}}, {{habits}}",
	},
	/** A measurement field and the unit it takes, e.g. "Weight (kg)". */
	measurement: {
		labelledUnit: "{{label}} ({{unit}})",
		/** Spoken names for the parts of a compound field. */
		unitKg: "kilograms",
		unitLb: "pounds",
		unitSt: "stones",
		unitCm: "centimetres",
		unitIn: "inches",
		unitFt: "feet",
		unitPercent: "percent",
	},
	consumption: {
		/** Context keeps room for languages whose generic serving word differs. */
		defaultServing_drink: "serving",
		defaultServing_food: "serving",
		/** One logged entry's quantity, serving, and local time. */
		entryDetail_drink: "{{quantity}} × {{serving}} · {{time}}",
		entryDetail_food: "{{quantity}} × {{serving}} · {{time}}",
	},
} as const;
