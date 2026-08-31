export const checkIn = {
	loadFailed: "The check-in could not be opened",
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
		moodHint: "How you feel right now, not how the day should have gone.",
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
