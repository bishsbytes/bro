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

/** Authored programme content; enrolment rows snapshot identity, not this copy. */
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
	{
		slug: "challenge:purpose-compass",
		title: "Find your next true direction",
		areaSlug: "wheel:purpose",
		durationDays: 3,
		intro: "Turn a broad search for purpose into one direction you can test.",
		days: [
			{
				day: 1,
				title: "Notice what pulls you",
				action:
					"Write down three moments when you felt useful, absorbed, or proud of how you showed up.",
			},
			{
				day: 2,
				title: "Name the thread",
				action:
					"Look across those moments and name the value or contribution they have in common.",
			},
			{
				day: 3,
				title: "Test one direction",
				action:
					"Choose one small action this week that puts that value into practice in real life.",
			},
		],
	},
	{
		slug: "challenge:fatherhood-presence",
		title: "Three days of present fatherhood",
		areaSlug: "wheel:fatherhood",
		durationDays: 3,
		intro:
			"Create a little more attention, curiosity, and steadiness as a dad.",
		days: [
			{
				day: 1,
				title: "Follow their lead",
				action:
					"Give your child ten minutes of full attention and let them choose what you do together.",
			},
			{
				day: 2,
				title: "Ask one real question",
				action:
					"Ask about something that matters in their world and listen without correcting or teaching.",
			},
			{
				day: 3,
				title: "Make one moment easier",
				action:
					"Prepare one small thing that will make tomorrow calmer or more connected for both of you.",
			},
		],
	},
	{
		slug: "challenge:quiet-reflection",
		title: "Three quiet points of reflection",
		areaSlug: "wheel:faith",
		durationDays: 3,
		intro:
			"Make private space for faith, spirituality, or the questions that matter most to you.",
		days: [
			{
				day: 1,
				title: "Become still",
				action:
					"Spend five quiet minutes in prayer, meditation, contemplation, or simple stillness.",
			},
			{
				day: 2,
				title: "Return to a source",
				action:
					"Read or listen to a short passage that helps you see your life from a wider perspective.",
			},
			{
				day: 3,
				title: "Live one value",
				action:
					"Choose one value your beliefs call you toward and practise it deliberately today.",
			},
		],
	},
	{
		slug: "challenge:sobriety-support",
		title: "Strengthen your recovery support",
		areaSlug: "wheel:sobriety",
		durationDays: 3,
		intro:
			"Reinforce the people, places, and choices that support your sobriety or recovery.",
		days: [
			{
				day: 1,
				title: "Name today's support",
				action:
					"Write down the person, practice, or place you can turn to if today becomes difficult.",
			},
			{
				day: 2,
				title: "Make contact",
				action:
					"Contact someone safe in your support network, even if you only say that you are checking in.",
			},
			{
				day: 3,
				title: "Protect the next choice",
				action:
					"Remove one avoidable risk and make your next supportive choice easier to follow through.",
			},
		],
	},
	{
		slug: "challenge:thirty-day-strength-block",
		title: "Thirty-day strength block",
		areaSlug: "wheel:health",
		durationDays: 30,
		intro:
			"Build a repeatable strength practice over thirty completed steps, at your pace and with movements that suit your body.",
		days: [
			{
				day: 1,
				title: "Choose your movements",
				action:
					"Choose one push, pull, squat, hinge, and carry or core movement that feel safe and accessible.",
			},
			{
				day: 2,
				title: "Set your starting point",
				action:
					"Do one comfortable set of each movement and record the weight or variation you used.",
			},
			{
				day: 3,
				title: "Practise control",
				action:
					"Repeat your movements slowly, stopping each set while you could still do two good repetitions.",
			},
			{
				day: 4,
				title: "Recover on purpose",
				action:
					"Take an easy walk or mobility break and notice which areas would benefit from more recovery.",
			},
			{
				day: 5,
				title: "Add a second set",
				action:
					"Complete two comfortable sets of each movement, keeping the same controlled form.",
			},
			{
				day: 6,
				title: "Make the setup easier",
				action:
					"Prepare your space, clothes, and equipment so the next session has less friction.",
			},
			{
				day: 7,
				title: "Review week one",
				action:
					"Write down what felt strong, what felt awkward, and one adjustment for next week.",
			},
			{
				day: 8,
				title: "Begin the second week",
				action:
					"Complete two sets and improve one small detail of your position or range of motion.",
			},
			{
				day: 9,
				title: "Brace and breathe",
				action:
					"Practise a steady brace and deliberate breathing through each movement today.",
			},
			{
				day: 10,
				title: "Progress one movement",
				action:
					"Add a small amount of weight, one repetition, or a slightly harder variation to one movement.",
			},
			{
				day: 11,
				title: "Restore your range",
				action:
					"Spend ten easy minutes moving the joints and muscles you have trained most.",
			},
			{
				day: 12,
				title: "Repeat the stronger session",
				action:
					"Repeat your two-set session and keep the progress you made on day ten if form stays sound.",
			},
			{
				day: 13,
				title: "Carry something well",
				action:
					"Practise a loaded carry or steady core hold with tall posture and calm breathing.",
			},
			{
				day: 14,
				title: "Review week two",
				action:
					"Check your notes and choose the one movement you most want to improve next week.",
			},
			{
				day: 15,
				title: "Start the middle strong",
				action:
					"Complete your session with extra attention on the movement you chose to improve.",
			},
			{
				day: 16,
				title: "Own the lowering phase",
				action:
					"Lower each repetition under control for a slow count before moving with intent.",
			},
			{
				day: 17,
				title: "Add useful volume",
				action:
					"Add a third set to one or two movements while leaving the others unchanged.",
			},
			{
				day: 18,
				title: "Recover and refuel",
				action:
					"Take an easy movement break and make one meal choice that supports your recovery.",
			},
			{
				day: 19,
				title: "Keep the third set",
				action:
					"Repeat day seventeen's structure if you feel recovered, or return to two sound sets if not.",
			},
			{
				day: 20,
				title: "Train your grip",
				action:
					"Give your carry, hang, or grip work a little focused practice without straining.",
			},
			{
				day: 21,
				title: "Review week three",
				action:
					"Compare your starting notes with today and record one concrete sign of progress.",
			},
			{
				day: 22,
				title: "Begin the final build",
				action:
					"Complete your best repeatable session: challenging enough to matter, controlled enough to repeat.",
			},
			{
				day: 23,
				title: "Strengthen the weak link",
				action:
					"Choose one movement that lags behind and practise a simpler, cleaner version of it.",
			},
			{
				day: 24,
				title: "Make one final progression",
				action:
					"Progress one movement by the smallest sensible step and record exactly what changed.",
			},
			{
				day: 25,
				title: "Move to recover",
				action:
					"Use an easy walk, mobility, or light technique practice to arrive fresher tomorrow.",
			},
			{
				day: 26,
				title: "Repeat with confidence",
				action:
					"Repeat your progressed session without adding more, aiming for calm and consistent repetitions.",
			},
			{
				day: 27,
				title: "Choose your keepers",
				action:
					"Pick the movements and session length you would genuinely continue after this block.",
			},
			{
				day: 28,
				title: "Practise the future session",
				action:
					"Do the shorter, sustainable session you want to carry into your normal week.",
			},
			{
				day: 29,
				title: "Retest your start",
				action:
					"Repeat your day-two starting session and compare the control, repetitions, or load.",
			},
			{
				day: 30,
				title: "Finish and continue",
				action:
					"Record what changed, celebrate finishing, and choose the first day of your next strength week.",
			},
		],
	},
] as const satisfies readonly ChallengeTemplate[];

const challengesBySlug = new Map<string, ChallengeTemplate>(
	CHALLENGE_CATALOGUE.map((challenge) => [challenge.slug, challenge]),
);
const challengesByArea = new Map<string, ChallengeTemplate>();
for (const challenge of CHALLENGE_CATALOGUE) {
	// A short starter remains the default review suggestion when an area also has
	// a longer programme. Longer programmes are resolved directly by slug.
	if (!challengesByArea.has(challenge.areaSlug)) {
		challengesByArea.set(challenge.areaSlug, challenge);
	}
}

export function resolveChallenge(slug: string): ChallengeTemplate | null {
	return challengesBySlug.get(slug) ?? null;
}

export function challengeForArea(areaSlug: string): ChallengeTemplate | null {
	return challengesByArea.get(areaSlug) ?? null;
}
