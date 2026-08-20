import { render } from "@testing-library/react-native";
import type { TodayHabit, TodayHabitsSnapshot } from "./habits/habits-store";
import type { ReviewResult } from "./review/review-store";
import { LifeScreen } from "./screens/life/life-screen";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

const emptyHabits = {
	localDay: "2026-08-20",
	hasHabits: false,
	habits: [],
	challenges: [],
};

function habit(id: string, label: string, completed: boolean): TodayHabit {
	return {
		habit: {
			id,
			slug: `habit:${id}`,
			customLabel: null,
			kind: "manual",
			metricSlug: null,
			areaSlug: null,
			direction: null,
			targetValue: null,
			daysOfWeek: 0b111_1111,
			position: 0,
			addedAt: 1,
			removedAt: null,
			createdAt: 1,
			updatedAt: 1,
		},
		label,
		completed,
		streak: 0,
		progressLabel: null,
	};
}

function scheduledHabits(readingDone: boolean): TodayHabitsSnapshot {
	return {
		localDay: "2026-08-20",
		hasHabits: true,
		habits: [
			habit("reading", "Read", readingDone),
			habit("walking", "Walk", true),
		],
		challenges: [],
	};
}

function wheelAt(completedAt: number): ReviewResult {
	const items = [
		{ slug: "wheel:health", label: "Health", position: 0 },
		{ slug: "wheel:career", label: "Work & career", position: 1 },
		{ slug: "wheel:relationships", label: "Relationships", position: 2 },
	];
	return {
		assessment: {
			id: `review-${completedAt}`,
			templateSlug: "wheel-of-life",
			templateVersion: 1,
			startedAt: completedAt - 1_000,
			completedAt,
			items,
			focusItemSlugs: ["wheel:career"],
			createdAt: completedAt,
			updatedAt: completedAt,
		},
		scores: items.map((item) => ({
			...item,
			value: 6,
			focused: item.slug === "wheel:career",
		})),
		previousAssessment: null,
		previousScores: [],
		comparisons: [],
	};
}

function stores(
	latest: ReviewResult | null,
	habits: TodayHabitsSnapshot = emptyHabits,
) {
	return {
		reviewStore: {
			loadOverview: jest.fn(async () => ({ sittings: [], goals: [] })),
			loadLatestWheel: jest.fn(async () => latest),
		},
		habitsStore: { loadToday: jest.fn(async () => habits) },
	};
}

describe("Life screen", () => {
	it("makes the first wheel review the empty-state hero", async () => {
		const screen = await render(
			<LifeScreen
				{...stores(null)}
				now={() => new Date("2026-08-20T12:00:00Z")}
			/>,
		);

		expect(
			await screen.findByText("Take stock of the bigger picture"),
		).toBeTruthy();
		expect(screen.getByText("WHEEL OF LIFE")).toBeTruthy();
	});

	it("shows current state without prompting after a recent review", async () => {
		const screen = await render(
			<LifeScreen
				{...stores(wheelAt(Date.parse("2026-08-01T12:00:00Z")))}
				now={() => new Date("2026-08-20T12:00:00Z")}
			/>,
		);

		expect(await screen.findByLabelText("Wheel of life chart")).toBeTruthy();
		expect(screen.getByText("Work & career")).toBeTruthy();
		expect(screen.queryByText("Time to take stock")).toBeNull();
	});

	it("prompts again when the latest review is over 35 days old", async () => {
		const screen = await render(
			<LifeScreen
				{...stores(wheelAt(Date.parse("2026-07-15T11:59:59Z")))}
				now={() => new Date("2026-08-20T12:00:00Z")}
			/>,
		);

		expect(await screen.findByText("Time to take stock")).toBeTruthy();
	});

	it("summarises how many of today's habits are complete", async () => {
		const screen = await render(
			<LifeScreen
				{...stores(null, scheduledHabits(false))}
				now={() => new Date("2026-08-20T12:00:00Z")}
			/>,
		);

		expect(await screen.findByText("2 today · 1 complete")).toBeTruthy();
	});

	it("reflects a habit toggle when the screen regains focus", async () => {
		const now = () => new Date("2026-08-20T12:00:00Z");
		const screen = await render(
			<LifeScreen {...stores(null, scheduledHabits(false))} now={now} />,
		);
		expect(await screen.findByText("2 today · 1 complete")).toBeTruthy();

		screen.rerender(
			<LifeScreen {...stores(null, scheduledHabits(true))} now={now} />,
		);

		expect(await screen.findByText("2 today · 2 complete")).toBeTruthy();
	});

	it("says so when habits are chosen but none fall on today", async () => {
		const screen = await render(
			<LifeScreen
				{...stores(null, {
					localDay: "2026-08-20",
					hasHabits: true,
					habits: [],
					challenges: [],
				})}
				now={() => new Date("2026-08-20T12:00:00Z")}
			/>,
		);

		expect(await screen.findByText("No habits scheduled today")).toBeTruthy();
	});
});
