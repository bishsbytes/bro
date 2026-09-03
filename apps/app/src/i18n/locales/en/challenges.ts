export const challenges = {
	backToToday: "Back to today",
	detail: {
		notFound: "Challenge run not found",
		notFoundBody: "This run is no longer available on this device.",
		/** {{started}} is a local day, {{done}} and {{total}} are step counts. */
		progress: "Started {{started}} · {{done}} of {{total}} steps complete",
		finishedTitle: "You finished it",
		finishedBody: "You completed all {{total}} steps of {{title}}.",
		endedTitle: "Challenge ended",
		endedBody:
			"This run's history has been kept. You can start a fresh run whenever you are ready.",
		startAgain: "Start again",
		/** Renders in capitals; see the note on eyebrows in the review catalogue. */
		dayOf: "Day {{day}} of {{total}}",
		dayTitle: "Day {{day}}",
		stepUnavailable:
			"The authored step is unavailable in this version, but your run and progress are preserved.",
		markStepDone: "Mark step done",
		abandonNote: "Ending this run keeps every completed step in History.",
		abandon: "Abandon challenge",
	},
	overview: {
		notFound: "Challenge not found",
		notFoundBody:
			"This starter challenge is not available in this version of the app.",
		backToReviews: "Back to reviews",
		summary: "{{total}}-day challenge · Advance one completed step at a time",
		start: "Start this challenge",
		day: "Day {{day}}",
		backToWheel: "Back to my wheel",
	},
} as const;
