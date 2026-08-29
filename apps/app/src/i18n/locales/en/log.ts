export const log = {
	intro:
		"Record what happened today and keep the measurements that matter in view.",
	loadFailed: "Today's log could not be loaded",
	loadFailedBody: "Try again.",
	/** Renders in capitals; see the note on eyebrows in the review catalogue. */
	todayEyebrow: "TODAY",
	bodyEyebrow: "YOUR BODY",
	drinks: "Drinks",
	food: "Food",
	entries_one: "{{count}} entry",
	entries_other: "{{count}} entries",
	/** {{name}} is a section or measurement name. */
	open: "Open {{name}}",
	measurements: {
		title: "Measurements",
		more: "More measurements",
		emptyTitle: "No body metrics tracked",
		emptyBody: "Turn on a measurement below to log it here and see its trend.",
		/** {{when}} is either an observation date or a local day. */
		latest: "Latest {{value}} · {{when}}",
		nothingLogged: "Nothing logged yet",
		/** Names the origin of an imported reading. */
		source: "Source: {{name}}",
		sourceYou: "You",
		track: "Track {{name}}",
		stopTracking: "Stop tracking {{name}}",
		enterPlaceholder: "Enter {{unit}}",
		enterIn: "Enter in {{unit}}",
		logMetric: "Log {{name}}",
	},
	goal: {
		target: "Target {{value}}",
		/** Appends a status note to the target line. */
		targetWithNote: "{{target}} · {{note}}",
		reached: "Target reached — mark it achieved?",
		percentComplete: "{{percent}}% of the way",
	},
} as const;
