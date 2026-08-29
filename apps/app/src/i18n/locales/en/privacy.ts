/** "bro" is the product name throughout and stays untranslated. */
export const privacy = {
	title: "Where your data lives",
	device: {
		heading: "On this device",
		records:
			"Your check-ins, notes, food logs, and other records are stored by bro on this device. Health data you import is read here too. Without optional sync, those records are never sent to bro's servers.",
		backup:
			"Your phone's platform backup may include bro's local records, depending on your Apple or Google backup settings. That backup is managed by your platform provider, not by bro.",
	},
	foodSearch: {
		heading: "Food search",
		body: "When you search for food, the text you type is sent to bro's server, which asks the food database provider for results. The query is not stored or tied to an account, device, or food log. Logging and everything else continue to work offline.",
	},
	sync: {
		heading: "Optional sync",
		body: "Sync is off unless you explicitly turn it on. If you choose it when it becomes available, your user-authored records and daily health summaries will be copied to your account so they can appear on your other devices. Detailed imported health samples and the food-search cache will remain device-local.",
	},
} as const;
