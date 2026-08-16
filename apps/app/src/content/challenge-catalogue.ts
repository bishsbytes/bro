import type { LifeAreaSlug } from "./life-area-catalogue";

export type ChallengeDay = {
	day: number;
	title: string;
	action: string;
};

export type ChallengeTemplate = {
	slug: `challenge:${string}`;
	title: string;
	areaSlug: LifeAreaSlug;
	durationDays: number;
	intro: string;
	days: readonly ChallengeDay[];
};

/**
 * Small, read-only starting points. They deliberately require no enrolment or
 * progress state: a person can read one and follow it by hand.
 */
export const CHALLENGE_CATALOGUE = [
	{
		slug: "challenge:work-reset",
		title: "A clearer working week",
		areaSlug: "wheel:career",
		durationDays: 3,
		intro: "Turn a vague work concern into one deliberate next move.",
		days: [
			{
				day: 1,
				title: "Name what matters",
				action:
					"Write down the one work outcome that would make this week feel worthwhile.",
			},
			{
				day: 2,
				title: "Remove one snag",
				action:
					"Spend fifteen minutes clearing the smallest obstacle in the way of that outcome.",
			},
			{
				day: 3,
				title: "Protect the next step",
				action:
					"Put one focused block in your calendar and decide what you will do first.",
			},
		],
	},
	{
		slug: "challenge:money-clarity",
		title: "Three days of money clarity",
		areaSlug: "wheel:money",
		durationDays: 3,
		intro: "Replace avoidance with a small, factual view of your money.",
		days: [
			{
				day: 1,
				title: "Look without judging",
				action:
					"Check your main balances and write down the numbers exactly as they are.",
			},
			{
				day: 2,
				title: "Find one leak",
				action:
					"Review recent spending and choose one cost to pause, cancel, or question.",
			},
			{
				day: 3,
				title: "Choose one rule",
				action:
					"Set one realistic money rule for the next seven days and write it somewhere visible.",
			},
		],
	},
	{
		slug: "challenge:health-basics",
		title: "Back to the health basics",
		areaSlug: "wheel:health",
		durationDays: 3,
		intro: "Use three ordinary actions to make looking after yourself easier.",
		days: [
			{
				day: 1,
				title: "Move gently",
				action:
					"Take a ten-minute walk or do another form of movement that feels manageable today.",
			},
			{
				day: 2,
				title: "Make rest easier",
				action:
					"Choose a bedtime and prepare one thing now that will help you keep it.",
			},
			{
				day: 3,
				title: "Prepare one good choice",
				action:
					"Put tomorrow's easiest nourishing food or movement option within reach.",
			},
		],
	},
	{
		slug: "challenge:partner-connection",
		title: "Make room for connection",
		areaSlug: "wheel:partner",
		durationDays: 3,
		intro:
			"Create a little more attention and warmth in your closest relationship.",
		days: [
			{
				day: 1,
				title: "Notice something good",
				action:
					"Tell your partner one specific thing you appreciated about them recently.",
			},
			{
				day: 2,
				title: "Ask and listen",
				action:
					"Ask how they are really doing, then listen without trying to solve it.",
			},
			{
				day: 3,
				title: "Plan shared time",
				action:
					"Agree on one small block of distraction-free time together this week.",
			},
		],
	},
	{
		slug: "challenge:family-touchpoints",
		title: "Three family touchpoints",
		areaSlug: "wheel:family",
		durationDays: 3,
		intro: "Strengthen one family connection through small, direct contact.",
		days: [
			{
				day: 1,
				title: "Reach out",
				action:
					"Send a message or make a call to one family member you want to feel closer to.",
			},
			{
				day: 2,
				title: "Share a memory",
				action:
					"Bring up a good shared memory and ask what they remember about it.",
			},
			{
				day: 3,
				title: "Make the next contact concrete",
				action:
					"Agree when you will next speak, meet, or do something together.",
			},
		],
	},
	{
		slug: "challenge:friendship-reconnect",
		title: "Reconnect with a friend",
		areaSlug: "wheel:friends",
		durationDays: 3,
		intro: "Move one friendship from good intentions back into real life.",
		days: [
			{
				day: 1,
				title: "Choose someone",
				action:
					"Pick one person you miss and send a simple message saying you thought of them.",
			},
			{
				day: 2,
				title: "Offer a real invitation",
				action:
					"Suggest a specific call, walk, coffee, or other easy way to catch up.",
			},
			{
				day: 3,
				title: "Be curious",
				action:
					"Ask one genuine question about their life and give the answer your full attention.",
			},
		],
	},
	{
		slug: "challenge:learning-sprint",
		title: "A tiny learning sprint",
		areaSlug: "wheel:growth",
		durationDays: 3,
		intro: "Restart your curiosity with a subject small enough to begin now.",
		days: [
			{
				day: 1,
				title: "Pick one question",
				action:
					"Write down one question you would genuinely enjoy being able to answer.",
			},
			{
				day: 2,
				title: "Learn for twenty minutes",
				action:
					"Read, watch, or practise for twenty focused minutes, stopping while it still feels interesting.",
			},
			{
				day: 3,
				title: "Explain what changed",
				action:
					"Write five sentences explaining what you understand now that you did not before.",
			},
		],
	},
	{
		slug: "challenge:make-room-for-fun",
		title: "Make room for fun",
		areaSlug: "wheel:fun",
		durationDays: 3,
		intro:
			"Treat enjoyment as something worth making space for, not a reward left until last.",
		days: [
			{
				day: 1,
				title: "Remember what works",
				action:
					"List three things you enjoy that need less than an hour and little or no planning.",
			},
			{
				day: 2,
				title: "Do the smallest one",
				action:
					"Choose one item from your list and give it at least fifteen uninterrupted minutes.",
			},
			{
				day: 3,
				title: "Put another in the diary",
				action:
					"Schedule the next enjoyable thing before the practical tasks take all the space.",
			},
		],
	},
	{
		slug: "challenge:calmer-space",
		title: "Three days to a calmer space",
		areaSlug: "wheel:environment",
		durationDays: 3,
		intro:
			"Make the space you spend the most time in work for you instead of against you.",
		days: [
			{
				day: 1,
				title: "Clear the surface you see most",
				action:
					"Completely clear the one surface you look at most often, and put back only what belongs there.",
			},
			{
				day: 2,
				title: "Fix one daily irritation",
				action:
					"Repair, replace, or remove one small thing that annoys you every single day.",
			},
			{
				day: 3,
				title: "Reset one corner",
				action:
					"Spend fifteen minutes making one corner of your home somewhere you actually like being.",
			},
		],
	},
] as const satisfies readonly ChallengeTemplate[];

const challengesBySlug = new Map<string, ChallengeTemplate>(
	CHALLENGE_CATALOGUE.map((challenge) => [challenge.slug, challenge]),
);
const challengesByArea = new Map<string, ChallengeTemplate>(
	CHALLENGE_CATALOGUE.map((challenge) => [challenge.areaSlug, challenge]),
);

export function resolveChallenge(slug: string): ChallengeTemplate | null {
	return challengesBySlug.get(slug) ?? null;
}

export function challengeForArea(areaSlug: string): ChallengeTemplate | null {
	return challengesByArea.get(areaSlug) ?? null;
}
