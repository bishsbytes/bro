export const checkIn = {
	loadFailed: "The check-in could not be opened",
	/** The two sittings a day holds, named wherever one is shown or chosen. */
	slots: {
		morning: {
			title: "Morning check-in",
			name: "Morning",
			tagline: "Start your day",
			moodHint: "How you feel as the day starts.",
		},
		evening: {
			title: "Evening check-in",
			name: "Evening",
			tagline: "Reflect and unwind",
			moodHint: "How you feel as the day ends.",
		},
	},
	/** Panel group headings shared by the check-in and its settings screen. */
	tagCategories: {
		body: "Body",
		lifestyle: "Lifestyle",
		mind: "Mind",
		social: "Social",
		sexual: "Sexual",
	},
	steps: {
		moodLabel: "Mood",
		/** Meaning and endpoints for each optional check-in score. */
		ratings: {
			fallbackDescription: "How this feels for you right now.",
			energy: {
				description:
					"How physically and mentally energised you feel right now.",
				minimum: "Drained",
				maximum: "Full of energy",
			},
			motivation: {
				description:
					"How much drive you feel to start or keep going with what matters.",
				minimum: "No motivation",
				maximum: "Highly motivated",
			},
			productivity: {
				description: "How effectively you have been getting things done today.",
				minimum: "Not productive",
				maximum: "Very productive",
			},
			libido: {
				description: "Your level of sexual desire right now.",
				minimum: "No desire",
				maximum: "Strong desire",
			},
		},
	},
	/** Today's two sitting cards. */
	sittings: {
		title: "Check-ins",
		done: "Done",
		start: "Check in",
		editA11y: "Edit {{sitting}} check-in: {{summary}}",
		startA11y: "Start {{sitting}} check-in",
	},
	nav: {
		back: "Back",
		close: "Close",
		closeA11y: "Close check-in",
		previousA11y: "Previous score",
		finishA11y: "Finish check-in",
		save: "Save",
		finish: "Finish",
		position: "{{current}} of {{total}}",
	},
	skip: "Skip",
	skipAndFinish: "Skip and finish",
	confirmation: {
		saved: "Checked in",
		updated: "Check-in updated",
		done: "Done",
		changeAnswer: "Change an answer",
	},
} as const;
