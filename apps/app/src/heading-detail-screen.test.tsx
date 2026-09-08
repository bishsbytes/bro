import type { Goal } from "@bro/database-app";
import { fireEvent, render } from "@testing-library/react-native";
import type { AreaPractice } from "./habits/habits-store";
import type { HeadingDetail } from "./review/review-store";
import { HeadingDetailScreen } from "./screens/life/heading-detail-screen";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

const now = () => new Date("2026-09-08T12:00:00Z");

const qualitative: Goal = {
	id: "goal-1",
	name: "Make time to unwind",
	intent: "20 minutes after work",
	areaSlug: "wheel:leisure",
	metricSlug: null,
	direction: null,
	targetValue: null,
	targetDate: null,
	startedAt: Date.parse("2026-09-01T09:00:00Z"),
	note: "A little space after a busy day.",
	achievedAt: null,
	abandonedAt: null,
	createdAt: 1,
	updatedAt: 1,
};

function detail(goal: Goal): HeadingDetail {
	return {
		heading: {
			goal,
			label: goal.name,
			areaLabel: "Leisure",
			status: goal.achievedAt ? "achieved" : "active",
			startValue: null,
			currentValue: null,
			progressPercent: null,
			targetReached: false,
			targetFormatted: null,
			startFormatted: null,
			currentFormatted: null,
		},
		areaOptions: [{ slug: "wheel:leisure", label: "Leisure" }],
	};
}

const practice: AreaPractice = {
	habit: {
		id: "habit-1",
		slug: "habit:custom:read",
		customLabel: "Read or sit quietly",
		kind: "manual",
		metricSlug: null,
		direction: null,
		targetValue: null,
		areaSlug: "wheel:leisure",
		daysOfWeek: 0b111_1111,
		position: 0,
		addedAt: 1,
		removedAt: null,
		createdAt: 1,
		updatedAt: 1,
	},
	label: "Read or sit quietly",
	completed: false,
	progressLabel: null,
	recentDays: ["2026-09-04", "2026-09-03"],
};

function stores(goal: Goal = qualitative) {
	return {
		store: {
			loadHeading: jest.fn(async () => detail(goal)),
			updateHeading: jest.fn(async () => goal),
			achieveGoal: jest.fn(async () => goal),
			abandonGoal: jest.fn(async () => goal),
		},
		habitsStore: {
			loadAreaPractices: jest.fn(async () => [practice]),
			toggleManual: jest.fn(async () => undefined),
		},
	};
}

describe("heading detail screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("leads with the heading's own words, its practice and what has been done", async () => {
		const screen = await render(
			<HeadingDetailScreen id="goal-1" {...stores()} now={now} />,
		);

		expect(await screen.findByText("Make time to unwind")).toBeTruthy();
		expect(screen.getByText("Active")).toBeTruthy();
		expect(screen.getByText("20 minutes after work")).toBeTruthy();
		expect(screen.getByText("Started September 1, 2026")).toBeTruthy();
		expect(screen.getByText("A little space after a busy day.")).toBeTruthy();
		// The practice, then the same completions again as recent activity.
		expect(screen.getAllByText("Read or sit quietly")).toHaveLength(3);
		expect(screen.getByText("Last done September 4")).toBeTruthy();
		expect(screen.getByText("September 3")).toBeTruthy();
	});

	it("marks a practice done against today", async () => {
		const state = stores();
		const screen = await render(
			<HeadingDetailScreen id="goal-1" {...state} now={now} />,
		);

		await fireEvent.press(await screen.findByText("Mark done"));
		expect(state.habitsStore.toggleManual).toHaveBeenCalledWith(
			"habit-1",
			"2026-09-08",
		);
	});

	it("explains what archive and remove do before either is pressed", async () => {
		const state = stores();
		const screen = await render(
			<HeadingDetailScreen id="goal-1" {...state} now={now} />,
		);

		expect(
			await screen.findByText(
				"Archiving keeps the heading and its history, and stops it counting as active.",
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				"Removing stops the heading without deleting it. It stays in your history, marked as removed.",
			),
		).toBeTruthy();

		await fireEvent.press(screen.getByText("Remove heading"));
		expect(state.store.abandonGoal).toHaveBeenCalledWith("goal-1");
		expect(state.store.achieveGoal).not.toHaveBeenCalled();
	});

	it("edits the words and dates, never what the heading is measured against", async () => {
		const state = stores();
		const screen = await render(
			<HeadingDetailScreen id="goal-1" {...state} now={now} />,
		);

		await fireEvent.press(await screen.findByText("Edit heading"));
		expect(await screen.findByText("Set your direction.")).toBeTruthy();
		await fireEvent.changeText(
			screen.getByLabelText("What are you aiming for?"),
			"30 minutes after work",
		);
		await fireEvent.press(screen.getByText("Save changes"));

		expect(state.store.updateHeading).toHaveBeenCalledWith("goal-1", {
			name: "Make time to unwind",
			intent: "30 minutes after work",
			areaSlug: "wheel:leisure",
			targetDate: null,
			startedAt: expect.any(Number),
			note: "A little space after a busy day.",
		});
	});
});
