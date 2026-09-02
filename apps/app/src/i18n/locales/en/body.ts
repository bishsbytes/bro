export const body = {
	notFound: "Measurement not found",
	notFoundBody: "This measurement is not available.",
	backToBody: "Back to Body",
	overview: {
		intro: "Every reading is measured against your own usual range.",
		loadFailed: "Your measurements could not be loaded",
		loadFailedBody: "Try again.",
	},
	measurements: {
		title: "Measurements",
		emptyTitle: "No measurements tracked",
		emptyBody: "Manage body data to choose the measurements shown here.",
		nothingLogged: "Nothing logged yet",
		/** Names the origin of an imported reading. */
		source: "Source: {{name}}",
		track: "Track {{name}}",
		stopTracking: "Stop tracking {{name}}",
		enterPlaceholder: "Enter {{unit}}",
		logMetric: "Log {{name}}",
	},
	log: {
		title: "Log body",
		intro: "Choose what you measured. Connected data appears automatically.",
		weight: "Weight",
		weightDetail: "Record one weight reading",
		session: "Take measurements",
		sessionDetail: "Tape sites and body fat, with weight if you took it",
		heartRate: "Resting heart rate",
		heartRateDetail: "Record a resting pulse in beats per minute",
		sessionFormIntro:
			"Enter whichever readings you took. Blank fields will be left unchanged.",
		singleFormIntro: "Enter the reading you took.",
		saveSession: "Save measurements",
		saveReading: "Save reading",
		back: "Back to log options",
		backToQuickLog: "Back to log menu",
		dismissA11y: "Close body log",
		emptyTitle: "Nothing is ready to log",
		emptyBody: "Choose the body data you want to track first.",
	},
	heart: {
		title: "Heart & fitness",
		emptyTitle: "No heart data tracked",
		emptyBody:
			"Track resting heart rate manually or connect a supported health platform.",
	},
	measuring: {
		link: "How to measure",
		intro: "Tap a site to see where the tape goes.",
		/** Spoken name for a site on the guide's figure. */
		siteA11y: "{{name}}, how to measure",
		everySiteTitle: "Every site",
		everySite:
			"Measure at the same time of day, before eating, with the tape flat against the skin and level all the way round. Pull it snug without pressing in.",
		sites: {
			neck: "Just below the Adam's apple, with the tape sloping slightly down at the front.",
			chest:
				"Around the fullest part, level under the armpits, arms down, at the end of a normal breath out.",
			bicep:
				"Around the fullest part of the upper arm, hanging relaxed at your side.",
			waist:
				"Around the navel, standing normally, at the end of a normal breath out. Do not hold it in.",
			hip: "Feet together, around the fullest part of the buttocks.",
			thigh:
				"Around the fullest part of the upper thigh, just under the buttock, with your weight even on both feet.",
		},
	},
	sites: {
		manage: "Manage body data",
		title: "Body data",
		intro:
			"Choose the measurements and fitness signals to keep on this screen.",
		dismissA11y: "Close body data",
	},
	reading: {
		/** {{when}} is a day: "Today", "Yesterday", or "3 Aug". */
		taped: "Taped {{when}}",
		measured: "Measured {{when}}",
		imported: "{{source}}, {{when}}",
	},
	read: {
		/** The band under the marker is the user's own range, never a target. */
		insideUsual: "Inside your usual {{min}}–{{max}}.",
		outsideUsual: "Outside your usual {{min}}–{{max}}.",
		noRange: "Not enough readings yet for a usual range.",
		down: "{{value}} down since {{when}}.",
		up: "{{value}} up since {{when}}.",
		unchanged: "Unchanged since {{when}}.",
		first: "First reading.",
		/** Joins the range line to the change line; reorder freely per language. */
		joined: "{{range}} {{change}}",
		/** Spoken form of a gauge: name, reading, then the same sentence shown. */
		gaugeA11y: "{{name}}, {{value}}. {{read}}",
	},
	change: {
		title: "Since last time",
		/** Hollow mark is the previous reading, filled is this one. */
		legend: "○ then · ● now",
		since: "since {{when}}",
		first: "first reading",
		notLogged: "nothing logged",
		meta: "{{source}} · {{comparison}}",
		/** Change is typeset with a sign and never coloured: direction is not a verdict. */
		down: "−{{value}}",
		up: "+{{value}}",
		none: "no change",
		/** Spoken form of a change row: the name, then the sentence it stands for. */
		rowA11y: "{{name}}. {{change}}",
	},
	/** {{when}} is a date and time, {{source}} names where the reading came from. */
	latestWithSource: "{{when}} · Source: {{source}}",
	readOnly:
		"Imported measurements are read-only in bro. Manage access in your health platform settings.",
	sourceYou: "You",
	goal: {
		title: "Goal",
		target: "Target {{value}}",
		/** Appends a status note to the target line. */
		targetWithNote: "{{target}} · {{note}}",
		/** Joins the two fragments below; reorder freely per language. */
		summary: "{{start}} · {{current}}",
		startValue: "Started at {{value}}",
		startValueUnknown: "No starting measurement",
		currentValue: "Latest {{value}}",
		currentValueUnknown: "No current measurement",
		targetDate: "Target date {{date}}",
		targetReached: "Target reached — mark it achieved?",
		percentComplete: "{{percent}}% of the way",
		achieve: "Mark goal achieved",
		abandon: "Stop goal",
		targetField: "Target",
		targetDateField: "Target date (optional)",
		/** Shown in the empty field; mirrors the format the input accepts. */
		targetDatePlaceholder: "YYYY-MM-DD",
		save: "Save goal",
		needMeasurement: "Log a measurement before setting a goal.",
		statusAchieved: "Achieved",
		statusAbandoned: "Stopped",
		/** {{status}} is one of the two labels above. */
		pastGoal: "{{status}}: target {{value}}",
	},
	history: {
		title: "History",
		empty: "No measurements logged yet.",
		valueField: "Value",
		/** {{id}} disambiguates rows for screen readers; it is not shown. */
		editA11y: "Edit {{name}} {{id}}",
		source: "Source: {{source}}",
		save: "Save measurement",
		saveA11y: "Save measurement {{id}}",
		delete: "Delete measurement",
		deleteA11y: "Delete measurement {{id}}",
		usedForDay: "Used for this day's value",
	},
} as const;
