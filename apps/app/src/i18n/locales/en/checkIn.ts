export const checkIn = {
	loadFailed: "The check-in could not be opened",
	mood: {
		low: "Low",
		flat: "Flat",
		okay: "Okay",
		good: "Good",
		sharp: "Very good",
	},
	/** The two sittings a day holds, named wherever one is shown or chosen. */
	slots: {
		morning: {
			title: "Morning check-in",
			name: "Morning",
			tagline: "Start with how you feel.",
		},
		evening: {
			title: "Evening check-in",
			name: "Evening",
			tagline: "Reflect and unwind",
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
		moodQuestion: "How are you feeling?",
		/** Meaning and endpoints for each optional check-in score. */
		ratings: {
			fallbackDescription: "How this feels for you right now.",
			energy: {
				question: "How is your energy?",
				description:
					"How physically and mentally energised you feel right now.",
				minimum: "Drained",
				maximum: "Full of energy",
			},
			motivation: {
				question: "How motivated do you feel?",
				description:
					"How much drive you feel to start or keep going with what matters.",
				minimum: "No motivation",
				maximum: "Highly motivated",
			},
			productivity: {
				question: "How productive have you felt?",
				description: "How effectively you have been getting things done today.",
				minimum: "Not productive",
				maximum: "Very productive",
			},
			libido: {
				question: "How is your sexual desire?",
				description: "Your level of sexual desire right now.",
				minimum: "No desire",
				maximum: "Strong desire",
			},
		},
	},
	/** Today's two sitting cards. */
	sittings: {
		partial: "Not answered: {{labels}}",
		title: "Your check-ins",
		dimensions: "{{labels}}.",
		complete: "Complete",
		partialStatus: "Partial",
		recorded: "{{date}} · {{time}} · {{source}}",
		manualSource: "Manual entry",
		done: "Done",
		start: "Check in",
		editA11y: "Edit {{sitting}} check-in: {{summary}}",
		startA11y: "Start {{sitting}} check-in",
	},
	note: {
		add: "Add a note (optional)",
		hint: "Opens a journal note for this day. Your check-in answers stay in place.",
	},
	answers: "Your answers",
	draft: {
		title: "Keep this check-in?",
		body: "Your answers can stay on this device until you are ready to save.",
		keep: "Keep draft",
		discard: "Discard",
		continue: "Continue editing check-in",
	},
	nav: {
		continue: "Continue",
		saveForNow: "Save for now",
		saveCheckIn: "Save check-in",
		back: "Back",
		backTo: "Back to {{step}}",
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
		partial: "Check-in saved for now",
		saved: "Checked in",
		updated: "Check-in updated",
		done: "Done",
		changeAnswer: "Change an answer",
	},
} as const;
