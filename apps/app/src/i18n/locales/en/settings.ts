export const settings = {
	loadFailedBody: "Try again.",
	index: {
		appearance: "Appearance",
		appearanceDetail:
			"Choose a theme and a quiet accent for actions and selections.",
		appearanceA11y: "Manage appearance",
		/** The chosen theme and accent, shown side by side. */
		appearanceValue: "{{theme}} · {{accent}}",
		health: "Health data",
		/** {{platform}} is Apple Health or Health Connect. */
		healthDetail: "Import from {{platform}}. Your data stays on this device.",
		healthA11y: "Manage health data",
		checkIns: "Check-ins",
		checkInsDetail: "Choose which scores appear after Mood.",
		checkInsA11y: "Manage check-ins",
		drinks: "Drinks",
		drinksDetail: "Choose drink totals and the units they use.",
		drinksA11y: "Manage drink logging",
		food: "Food",
		foodDetail: "Choose nutrition totals for Trends and goals.",
		foodA11y: "Manage food logging",
		units: "Units & format",
		unitsDetail: "Choose how weeks and body measurements appear.",
		unitsA11y: "Manage units and format",
		reminders: "Reminders",
		remindersDetail: "Choose when this device nudges you to check in.",
		remindersA11y: "Manage reminders",
		privacy: "Privacy",
		privacyDetail: "See what stays local and when data can leave this device.",
		privacyA11y: "Privacy information",
		licences: "Data licences",
		licencesDetail: "Attribution for data used in bro.",
		licencesA11y: "Data licences",
		export: "Export your data",
		exportDetail: "Share or save a copy of the record on this device.",
		exportA11y: "Export your data",
	},
	localData: {
		title: "Data on this device",
		intro:
			"Delete your check-ins, notes, and metric preferences from this device.",
		delete: "Delete local data",
		confirmTitle: "Delete local data?",
		confirmBody:
			"This permanently deletes data stored by bro on this device. It does not delete your account or data stored elsewhere.",
		confirmAction: "Permanently delete local data",
		cancel: "Cancel",
		failed: "Local data could not be deleted.",
		doneTitle: "Local data deleted",
		doneBody:
			"Check-ins, notes, and metric preferences have been removed from this device.",
		backToToday: "Back to today",
	},
	appearance: {
		intro:
			"Keep bro calm and monochrome, or add a little colour where it matters. Changes appear instantly and stay on this device.",
		themeTitle: "Theme",
		themeA11y: "{{name}} theme",
		themeSystem: "System",
		themeSystemDetail: "Match this device",
		themeLight: "Light",
		themeLightDetail: "Always use light mode",
		themeDark: "Dark",
		themeDarkDetail: "Always use dark mode",
		accentTitle: "Accent colour",
		accentIntro:
			"Used for primary actions, selected days, charts, and active navigation.",
		accentA11y: "{{name}} accent",
		accentNeutral: "Neutral",
		accentEmerald: "Emerald",
		accentSky: "Sky",
		accentRose: "Rose",
		accentAmber: "Amber",
		accentAmethyst: "Amethyst",
	},
	checkIns: {
		loadFailed: "Check-in settings could not be loaded",
		intro:
			"Mood is always included. Choose which optional scores you want available during check-ins.",
		scored: "Scored from 1 to 5",
		scoredSensitive: "Sensitive · scored from 1 to 5",
		sensitive: "Sensitive",
		addScore: "Add {{name}} from check-ins",
		removeScore: "Remove {{name}} from check-ins",
		scoresNote:
			"Turning a score off does not delete anything you already logged.",
		tagsTitle: "What happened",
		tagsIntro:
			"Choose the tags you want to see under your check-in. Keep the list short enough to tap through in seconds.",
		addTag: "Add {{name}} tag",
		removeTag: "Remove {{name}} tag",
		tagsNote: "Turning a tag off does not delete anything you already logged.",
	},
	drinks: {
		loadFailed: "Drink settings could not be loaded",
		intro:
			"Choose which daily drink totals appear in Trends. Logging remains available whichever metrics you track.",
		openLog: "Open drink log",
		trendsTitle: "Trends and goals",
		metricDetail: "Daily total from your logged drinks",
		track: "Track {{name}}",
		stopTracking: "Stop tracking {{name}}",
		unitsTitle: "Display units",
		example: "Example: {{value}}",
		useUnit: "Use {{unit}} for {{setting}}",
	},
	food: {
		loadFailed: "Food settings could not be loaded",
		intro:
			"Choose which daily nutrition totals appear in Trends. Logging remains available whichever metrics you track.",
		openLog: "Open food log",
		trendsTitle: "Trends and goals",
		metricDetail: "Daily total from food and other applicable entries",
		track: "Track {{name}}",
		stopTracking: "Stop tracking {{name}}",
		unitsTitle: "Display units",
		unitsBody:
			"Energy is shown in kcal. Protein, carbohydrate, and fat are shown in grams.",
	},
	/** Display names for the units a person can choose between. */
	unitNames: {
		kg: "Kilograms",
		lb: "Pounds",
		st: "Stones & pounds",
		cm: "Centimetres",
		in: "Inches",
		ft: "Feet & inches",
		percent: "Percent",
		g: "Grams",
		mg: "Milligrams",
		uk_unit: "UK units",
		us_standard_drink: "US standard drinks",
		ml: "Millilitres",
		l: "Litres",
		fl_oz_uk: "UK fluid ounces",
		fl_oz_us: "US fluid ounces",
		kcal: "Kilocalories",
		kJ: "Kilojoules",
	},
	/**
	 * Units written as words inside a reading, e.g. "2.6 units". Symbols like
	 * kg or ml read the same everywhere and are not listed.
	 */
	unitWords: {
		uk_unit_one: "unit",
		uk_unit_other: "units",
		us_standard_drink_one: "standard drink",
		us_standard_drink_other: "standard drinks",
		fl_oz_one: "fl oz",
		fl_oz_other: "fl oz",
	},
	/** Titles and explanations for each measurement a unit applies to. */
	dimensions: {
		massTitle: "Weight",
		massDescription: "Used for weight entries, history, trends, and goals.",
		heightTitle: "Height",
		heightDescription: "Used for height measurements.",
		lengthTitle: "Other body measurements",
		lengthDescription: "Used for waist and other circumference measurements.",
		fractionTitle: "Body fat",
		fractionDescription: "Body fat is always displayed as a percentage.",
		alcoholTitle: "Alcohol",
		volumeTitle: "Fluid",
	},
	units: {
		intro:
			"Choose how dates and measurements appear. Stored values stay unchanged, so format choices never change your history or goals.",
		updateFailed: "Units could not be updated",
		weekStartTitle: "Week starts on",
		weekStartIntro:
			"Used to order days in the Today week strip and day pickers.",
		weekStartA11y: "Start weeks on {{day}}",
		monday: "Monday",
		sunday: "Sunday",
		saturday: "Saturday",
		example: "Example: {{value}}",
		deviceDefault: "Device default: {{unit}}. Choose an option to override it.",
		unsupportedUnit:
			"A saved unit is no longer supported. Using {{unit}} until you choose another.",
		useUnit: "Use {{unit}} for {{setting}}",
	},
	reminders: {
		everyDay: "Every day",
		badTime: "Enter a time from 00:00 through 23:59.",
		needDay: "Choose at least one day.",
		editorTitle: "Reminder schedule",
		timeField: "Time (24-hour)",
		timePlaceholder: "20:00",
		addDay: "Add {{day}}",
		removeDay: "Remove {{day}}",
		save: "Save reminder",
		cancel: "Cancel",
		deniedTitle: "Notifications are off",
		deniedBody:
			"Your schedules are saved, but reminders stay silent until you turn notifications on in system settings.",
		openSystemSettings: "Open system settings",
		updateFailed: "Reminders could not be updated",
		emptyTitle: "No reminders yet",
		emptyBody:
			"Add a schedule for the days and time you want this phone to nudge you.",
		add: "Add reminder",
		enable: "Enable {{time}} reminder",
		disable: "Disable {{time}} reminder",
		edit: "Edit",
		delete: "Delete",
	},
	health: {
		loadFailed: "Health data could not be loaded",
		/** {{platform}} is Apple Health or Health Connect throughout. */
		unavailable: "{{platform}} is unavailable",
		manageAccess: "Manage access in {{platform}}",
		disconnectPlatform: "Disconnect {{platform}}",
		connect: "Connect {{platform}}",
		/** Renders in capitals; see the note on eyebrows in the review catalogue. */
		eyebrow: "ON THIS DEVICE",
		intro:
			"Import sleep, steps, resting heart rate, weight, and body fat to see them beside your check-ins and body measurements.",
		localNote:
			"Health data is read directly from your phone and stays on this device. Bro never sends it to a server.",
		connectedTitle: "Connected data",
		waitingForImport: "Waiting for first import",
		lastImported: "Last imported {{when}}",
		healthkitNote:
			"Apple Health does not reveal which data types you allowed. Anything you declined simply stays empty here.",
		refresh: "Refresh health data",
		disconnectTitle: "Disconnect",
		disconnectBody:
			"Disconnecting stops future imports. Data already imported stays in bro. Revoke the phone's permission in {{platform}} settings.",
	},
	export: {
		intro:
			"This JSON file contains the record stored by bro on this device. It leaves only when you choose where to share or save it.",
		title: "What to include",
		includeSensitive: "Include sensitive data",
		includeSensitiveDetail:
			"Includes sensitive metrics, custom habits, and sensitive life areas.",
		share: "Share or save export",
		savingClosed: "Saving closed. Your data stayed on this device.",
		saved: "Export saved to the folder you chose.",
		/** Subject and title on the iOS share sheet; "bro" is the product name. */
		shareTitle: "bro data export",
		sharingClosed: "Sharing closed. Your data stayed on this device.",
		/** {{app}} is whichever app the share sheet handed the file to. */
		sharedWith: "Export shared with {{app}}.",
		handedOver: "Export handed to the app you chose.",
		unsupportedPlatform: "Data export is available on iOS and Android.",
	},
	licences: {
		/** Open Food Facts and ODbL are proper names and stay untranslated. */
		title: "Open Food Facts",
		eyebrow: "FOOD DATA",
		provider:
			"Food search results are provided by Open Food Facts and its contributors.",
		licence:
			"The Open Food Facts database is available under the Open Database License (ODbL) 1.0. The licence requires attribution and share-alike for public adaptations of the database.",
		attribution: "Source: Open Food Facts · Licence: ODbL-1.0",
	},
	account: {
		row: "Settings",
		rowDetail: "Reminders, health data, units, and local data.",
		rowA11y: "Open settings",
		signedOut: "Signed out on this device.",
		signedOutPending:
			"Signed out on this device. The server could not be reached.",
		signOutFailed: "Could not sign out.",
		deleted: "Your account was deleted. Data on this device is still here.",
		deleteFailed: "Could not delete the account.",
		anonymousTitle: "Using bro without an account",
		anonymousBody:
			"Creating or signing into an account does not move or back up data on this device.",
		signIn: "Sign in",
		createAccount: "Create an account",
		checking: "Checking your account…",
		unavailableTitle: "Account temporarily unavailable",
		unavailableBody:
			"Your account could not be refreshed. You can keep using your data on this device.",
		signOut: "Sign out",
		ownershipNote: "Your account does not own or back up data on this device.",
		dangerZone: "Danger zone",
		deleteAccount: "Delete account",
		signOutTitle: "Sign out on this device?",
		signOutBody:
			"Your data on this device will stay here and remain available. This does not delete your account.",
		deleteTitle: "Delete your account?",
		deleteBody:
			"This permanently deletes your account and everything we hold for it. Your data on this device will stay here.",
		passwordField: "Current password",
		cancel: "Cancel",
	},
} as const;
