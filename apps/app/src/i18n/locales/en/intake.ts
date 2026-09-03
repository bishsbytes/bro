/**
 * Copy for the Intake tab and everything behind it: one log for food, drink,
 * and the optional streams, the library, goals, and settings. The register is
 * the design's: a day is a time-stamped stream read against the user's own
 * usual — totals are stated and never graded, nothing counts down, no meal
 * slots, no praise or concern — and a logged entry is data, not a confession.
 * The user never meets the word constituent; the friendlier words are Food &
 * drink, Supplements, Smoking & vaping.
 */
export const intake = {
	loadFailed: "Today's intake could not be loaded",
	loadFailedBody: "Try again.",
	tab: {
		totalsEmpty:
			"Choose what to track in intake settings and the day's totals will appear here.",
		/** Meta beside a total's name while the day is still going. */
		soFarToday: "so far today",
		/** Meta beside a stimulant total: when the last one was. */
		lastAt: "last at {{time}}",
		/** Said once per card, only while a tracked total has no band yet. */
		rangeNote: "A usual range appears once a total has {{count}} logged days.",
		disclaimer: "Totals are stated without targets, allowances, or ratings.",
		/** The hero card's two views of the day. */
		summary: "Summary",
		logged: "Logged",
		previousDay: "Previous day",
		nextDay: "Next day",
		entryCount_one: "{{count}} entry",
		entryCount_other: "{{count}} entries",
		emptyTitle: "Nothing logged",
		emptyBody: "Log only when it is useful. An empty day stays empty.",
		manageTitle: "Manage",
		library: "Your library",
		libraryDetail: "Foods, drinks, and recipes you use often.",
		goals: "Headings",
		goalsDetail: "Review or change headings for what you track.",
		settings: "Intake settings",
		settingsDetail: "Streams, what you track, and units.",
	},
	/**
	 * The one-line read under a total. It states the user's own usual as fact:
	 * never a target, never remaining, never over or under.
	 */
	read: {
		usual: "Your days usually land between {{min}} and {{max}}.",
		/** For a total that is zero on most logged days; {{days}} is a phrase below. */
		bimodal:
			"Most of your days: none. {{days}} usually land between {{min}} and {{max}}.",
		bimodalNone: "Most of your days: none.",
		days: {
			ethanol: "Drinking days",
			nicotine: "Smoking days",
			caffeine: "Days with caffeine",
			default: "Days with any",
		},
		/** Spoken form of a gauge: name, the day's total, then the read. */
		gaugeA11y: "{{name}}, {{value}}. {{read}}",
	},
	/** One row of the day's stream. */
	entry: {
		/** Quantity and portion, e.g. "2 × pint". */
		portion: "{{quantity}} × {{portion}}",
		/** Spoken form of a row: the name, its figures, then when. */
		rowA11y: "{{name}}, {{detail}}, at {{time}}",
		editHint: "Opens the entry to change or delete it",
		/** Heading for a grouped row's entries in the edit sheet. */
		groupIntro_one: "{{count}} entry at this sitting. Choose one to change it.",
		groupIntro_other:
			"{{count}} entries at this sitting. Choose one to change it.",
		pickA11y: "Change the entry at {{time}}",
		backToGroup: "Back to the entries",
	},
	kinds: {
		food: "Food",
		drink: "Drink",
		supplement: "Supplement",
		medication: "Medication",
		nicotine: "Smoke or vape",
		other: "Something else",
	},
	/** Stream names as settings and section headings show them. */
	streams: {
		food: "Food",
		drink: "Drinks",
		supplement: "Supplements",
		medication: "Medication",
		nicotine: "Smoking & vaping",
		other: "Other",
	},
	log: {
		title: "Log",
		searchPlaceholder: "What did you have?",
		searchA11y: "Search food and drink",
		clearA11y: "Clear search",
		kindA11y: "Show {{name}}",
		/** Recents are ranked by how close their time of day is to now. */
		recentsTitle: "Usually around now",
		recentsEmpty:
			"What you log will appear here, ranked by the time of day you have it.",
		recentHint:
			"Logs it again at the same portion. Press and hold to change the amount or the time.",
		libraryTitle: "Your library",
		libraryEmpty: "Foods and drinks you save will appear here.",
		catalogueTitle: "Browse",
		resultsTitle: "Search results",
		noResults: "Nothing matches that. You can still add it yourself.",
		cachedEyebrow: "Saved for offline",
		/** The provider and the licence its data is published under. */
		provenance: "{{source}} · {{licence}}",
		stillAvailable:
			"Your recents, library, and saved results are still available.",
		/** {{rest}} is the sentence above, appended to each outcome. */
		offline: "Search needs a connection. {{rest}}",
		busy: "Search is busy right now. Try again in a moment. {{rest}}",
		unavailable: "Search is temporarily unavailable. {{rest}}",
		queryLength: "Enter between 2 and 120 characters.",
		freeTitle: "Something else",
		freeDetail:
			"Log an item that is not listed, with whatever numbers you have.",
		logA11y: "Log {{name}}",
		repeatA11y: "Log {{name}} again",
		/** An item and the portion it was logged in. */
		option: "{{item}} · {{portion}}",
		added: "{{name}} added",
		viewDay: "View day",
		portionTitle: "Log {{name}}",
		portion: "Portion",
		byWeight: "By weight ({{unit}})",
		byVolume: "By volume ({{unit}})",
		quantity: "How many",
		/** The stepper's reading, e.g. "2 × pint". */
		quantityValue: "{{quantity}} × {{portion}}",
		fewer: "One fewer",
		more: "One more",
		half: "½",
		one: "1",
		two: "2",
		custom: "Custom",
		customQuantity: "How many, exactly",
		when: "When",
		now: "Now",
		earlier: "Earlier",
		date: "Date",
		time: "Time",
		yesterday: "Yesterday",
		save: "Log it",
		cancel: "Cancel",
		dismissA11y: "Close item details",
	},
	free: {
		name: "What was it?",
		namePlaceholder: "e.g. cigarillo, flat white, oat bar",
		portionLabel: "Portion (optional)",
		portionPlaceholder: "glass, mug, bar",
		nutritionTitle: "Per portion",
		energy: "Energy (kcal)",
		protein: "Protein (g)",
		carbohydrate: "Carbohydrate (g)",
		fat: "Fat (g)",
		fluid: "Volume (ml)",
		abv: "ABV % (optional)",
		caffeine: "Caffeine (mg)",
		nicotine: "Nicotine (mg)",
		hint: "Enter what you know. A rough figure is a real entry; it only needs to be consistent.",
		save: "Log it",
	},
	event: {
		/** The word used when a portion has no name of its own. */
		defaultPortion: "portion",
		/** One logged event's quantity, portion, and local time. */
		detail: "{{quantity}} × {{portion}} · {{time}}",
		edit: "Edit {{name}}",
		editTitle: "Edit entry",
		delete: "Delete entry",
		name: "Name",
		portion: "Portion",
		quantity: "Quantity",
		date: "Date",
		time: "Time",
		save: "Save changes",
		storedSnapshot: "Stored: {{value}}",
		dismissA11y: "Close entry",
	},
	day: {
		emptyTitle: "No entries",
		emptyBody: "Nothing was logged on this day.",
	},
	goals: {
		title: "Headings",
		needMetrics:
			"Turn on totals in intake settings to add them to Trends and set headings.",
		/** A goal is stated against a seven-day average and never graded. */
		summary: "Heading {{target}} · Seven-day average {{current}}",
		achieve: "Archive heading",
		abandon: "Remove heading",
		targetField: "Heading ({{unit}})",
		targetDateField: "By (optional)",
		save: "Save heading",
		setFor: "Set heading for {{name}}",
		needValue: "Log something first, so a heading has somewhere to start.",
	},
	library: {
		title: "Your library",
		empty:
			"Save foods, drinks, and recipes you use often. They stay available offline.",
		create: "New item",
		edit: "Edit",
		delete: "Delete",
		editA11y: "Edit {{name}}",
		deleteA11y: "Delete {{name}}",
		editorTitle: "Edit item",
		newTitle: "New item",
		recipeToggle: "Recipe",
		itemToggle: "Item",
		kind: "Kind",
		name: "Name",
		brand: "Brand (optional)",
		portionLabel: "Portion",
		portionPlaceholder: "serving, pot, tablet",
		nutritionTitle: "Per portion",
		moreNutrients: "More nutrients",
		fewerNutrients: "Fewer nutrients",
		quantityHelp: "Enter at least one value.",
		/** Under the ABV field: units are worked out, never typed. */
		abvHelp: "Alcohol units are worked out from the volume and the ABV.",
		yieldTitle: "Makes",
		yieldQuantity: "How many",
		yieldUnit: "Unit",
		yieldUnits: {
			serving: "servings",
			portion: "portions",
			glass: "glasses",
			ml: "ml",
			g: "g",
		},
		ingredientsTitle: "Ingredients",
		/** An ingredient and how much of it goes in, e.g. "2 × Egg". */
		ingredient: "{{quantity}} × {{name}}",
		ingredientName: "Ingredient",
		ingredientQuantity: "Quantity",
		ingredientNutrition: "Per one, as entered",
		addIngredient: "Add ingredient",
		removeIngredient: "Remove",
		ingredientsEmpty: "Add at least one ingredient.",
		/** Said once, when editing something bro or a provider supplied. */
		forked: "Based on {{name}}. Your changes make a copy that is yours.",
		source: {
			user: "Yours",
			system: "bro",
			provider: "{{name}}",
			community: "Community",
		},
		save: "Save",
		cancel: "Cancel",
		/** Open Food Facts and ODbL are proper names and stay untranslated. */
		licenceNotice:
			"Food data from Open Food Facts under ODbL 1.0 · Licence details",
	},
	settings: {
		loadFailed: "Intake settings could not be loaded",
		intro:
			"Choose which streams you log, which totals appear in Trends and on the Intake tab, and the units they use.",
		openTab: "Open intake",
		streamsTitle: "Streams",
		streamsIntro:
			"Food and drink are always on. Anything else appears only once you switch it on here.",
		streamDetail: {
			supplement: "Log tablets, powders, and what they contain.",
			medication: "Log what you take. Nothing is scheduled or reminded.",
			nicotine: "Log cigarettes and vapes, with a nicotine total in Trends.",
			other: "Log anything else you take in.",
		},
		streamOn: "Turn on {{name}}",
		streamOff: "Turn off {{name}}",
		trackTitle: "Totals",
		trackIntro:
			"Each total is summed from what you log and shown against your own usual range.",
		metricDetail: "Daily total from what you log",
		track: "Track {{name}}",
		stopTracking: "Stop tracking {{name}}",
		moreNutrients: "More nutrients",
		fewerNutrients: "Fewer nutrients",
		categories: {
			energy: "Energy",
			macronutrient: "Nutrition",
			micronutrient: "Vitamins & minerals",
			hydration: "Hydration",
			stimulant: "Stimulants",
			alcohol: "Alcohol",
			supplement: "Supplements",
			medication: "Medication",
			other: "Other",
		},
		unitsTitle: "Display units",
		unitDetail: {
			alcohol: "Alcohol",
			volume: "Fluid",
			sodium: "Sodium",
			energy: "Energy",
		},
		example: "Example: {{value}}",
		useUnit: "Use {{unit}} for {{setting}}",
		unitA11y: "Choose the unit for {{setting}}",
		unitDismissA11y: "Close {{setting}} options",
		estimateNote:
			"Caffeine and nicotine amounts are estimates from what you logged, not a measurement of what you absorbed.",
	},
} as const;
