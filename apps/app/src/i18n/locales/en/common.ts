/**
 * Copy shared across features. Wording used by two or more screens belongs
 * here; anything one screen owns stays in that feature's catalogue.
 */
export const common = {
	support: {
		title: "Mental health support (UK)",
		detail:
			"Open the NHS website for support options. Opens in your browser and needs an internet connection.",
		failed:
			"The NHS page could not be opened. Visit nhs.uk and search for urgent mental health help.",
	},
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
	timePicker: {
		chooseTime: "Choose time",
		openHint: "Opens the time picker",
		noTimeSelected: "No time selected",
		cancel: "Cancel",
		done: "Done",
	},
	/** Text formatting controls on a note composer. */
	format: {
		bold: "Bold",
		italic: "Italic",
		list: "Bullet list",
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
		trendChartUsualRange: "Usual range {{min}} to {{max}}.",
		trendChartHeading: "Heading {{value}}.",
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
	terrain: {
		explore:
			"Drag sideways or use the reading controls to explore dates and values.",
		missing: "No reading",
		previous: "Previous day",
		next: "Next day",
		latest: "Back to latest",
		showReadings: "Show readings",
		hideReadings: "Hide readings",
		usualRange: "Usual range",
		heading: "{{value}} heading",
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
		unitBpm: "beats per minute",
	},
} as const;
