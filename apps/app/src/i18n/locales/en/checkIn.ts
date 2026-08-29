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
		/** Shown under every optional scale so a 1 and a 5 mean the same daily. */
		optionalHint: "1 is as low as it gets, 5 is as good as it gets.",
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
