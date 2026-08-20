import { render } from "@testing-library/react-native";
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

function stores(latest: ReviewResult | null) {
	return {
		reviewStore: {
			loadOverview: jest.fn(async () => ({ sittings: [], goals: [] })),
			loadLatestWheel: jest.fn(async () => latest),
		},
		habitsStore: { loadToday: jest.fn(async () => emptyHabits) },
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
});
