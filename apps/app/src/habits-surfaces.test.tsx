import type { ChallengeEnrolment, Habit } from "@bro/database-app";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { resolveChallenge } from "./content/challenge-catalogue";
import { resolveHabit } from "./content/habit-catalogue";
import { ChallengeDetailScreen } from "./screens/challenge-detail-screen";
import { ChallengeScreen } from "./screens/challenge-screen";
import { HabitDetailScreen } from "./screens/habit-detail-screen";
import { HabitsScreen } from "./screens/habits-screen";

const mockRouter = {
	back: jest.fn(),
	push: jest.fn(),
	replace: jest.fn(),
};

jest.mock("expo-router", () => ({
	router: {
		back: (...args: unknown[]) => mockRouter.back(...args),
		push: (...args: unknown[]) => mockRouter.push(...args),
		replace: (...args: unknown[]) => mockRouter.replace(...args),
	},
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

describe("habit and challenge surfaces", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("prefills a catalogue habit and saves its snapshot", async () => {
		const reading = resolveHabit("habit:reading");
		if (!reading)
			throw new Error("Reading habit is missing from the catalogue.");
		const savedHabit: Habit = {
			id: "habit-1",
			slug: reading.slug,
			customLabel: null,
			kind: reading.kind,
			metricSlug: reading.metricSlug,
			direction: reading.direction,
			targetValue: reading.defaultTargetValue,
			daysOfWeek: reading.defaultDaysOfWeek,
			position: 0,
			addedAt: 1,
			removedAt: null,
			createdAt: 1,
			updatedAt: 1,
		};
		const addTemplate = jest.fn(async () => savedHabit);
		const store = {
			loadSettings: jest.fn(async () => ({
				active: [],
				groups: [
					{
						areaSlug: reading.areaSlug,
						areaLabel: "Growth",
						more: false,
						habits: [reading],
					},
				],
			})),
			addTemplate,
			addCustom: jest.fn(),
			updateHabit: jest.fn(),
			removeHabit: jest.fn(),
			moveHabit: jest.fn(),
		};
		const screen = await render(<HabitsScreen store={store} />);

		await fireEvent.press(await screen.findByLabelText("Add Read"));
		expect(screen.getByDisplayValue("Read")).toBeTruthy();
		await fireEvent.press(screen.getByText("Save habit"));

		await waitFor(() =>
			expect(addTemplate).toHaveBeenCalledWith(reading, {
				label: "Read",
				daysOfWeek: reading.defaultDaysOfWeek,
				targetValue: null,
			}),
		);
	});

	it("starts an authored challenge and opens its run", async () => {
		const challenge = resolveChallenge("challenge:health-basics");
		if (!challenge) throw new Error("Health challenge is missing.");
		const enrolment: ChallengeEnrolment = {
			id: "run-1",
			challengeSlug: challenge.slug,
			title: challenge.title,
			durationDays: challenge.durationDays,
			areaSlug: challenge.areaSlug,
			startedOn: "2026-08-14",
			completedAt: null,
			abandonedAt: null,
			createdAt: 1,
			updatedAt: 1,
		};
		const startChallenge = jest.fn(async () => enrolment);
		const screen = await render(
			<ChallengeScreen
				challengeSlug="challenge:health-basics"
				store={{ startChallenge }}
			/>,
		);

		await fireEvent.press(screen.getByText("Start this challenge"));

		await waitFor(() => {
			expect(startChallenge).toHaveBeenCalledWith("challenge:health-basics");
			expect(mockRouter.replace).toHaveBeenCalledWith("/challenges/run-1");
		});
	});

	it("shows the finish moment after the last challenge step", async () => {
		const challenge = resolveChallenge("challenge:health-basics");
		if (!challenge) throw new Error("Health challenge is missing.");
		const active = {
			enrolmentId: "run-1",
			challengeSlug: challenge.slug,
			title: challenge.title,
			durationDays: challenge.durationDays,
			areaSlug: challenge.areaSlug,
			startedOn: "2026-08-14",
			completedAt: null,
			abandonedAt: null,
			completedDayIndexes: [1, 2],
			nextDayIndex: 3,
			isFinished: false,
			currentDay: challenge.days[2] ?? null,
			contentAvailable: true,
		};
		const finished = {
			...active,
			completedAt: 1,
			completedDayIndexes: [1, 2, 3],
			nextDayIndex: null,
			isFinished: true,
			currentDay: null,
		};
		const completeChallengeDay = jest.fn(async () => finished);
		const screen = await render(
			<ChallengeDetailScreen
				enrolmentId="run-1"
				store={{
					loadChallenge: jest.fn(async () => active),
					completeChallengeDay,
					abandonChallenge: jest.fn(),
					startChallenge: jest.fn(),
				}}
			/>,
		);

		await fireEvent.press(await screen.findByText("Mark step done"));

		await waitFor(() =>
			expect(completeChallengeDay).toHaveBeenCalledWith("run-1", 3),
		);
		expect(await screen.findByText("You finished it")).toBeTruthy();
	});

	it("renders the four adherence states as a descriptive habit record", async () => {
		const habit: Habit = {
			id: "habit-1",
			slug: "habit:steps-10k",
			customLabel: null,
			kind: "metric",
			metricSlug: "steps",
			direction: "at_least",
			targetValue: 10_000,
			daysOfWeek: 0b111_1111,
			position: 0,
			addedAt: 1,
			removedAt: null,
			createdAt: 1,
			updatedAt: 1,
		};
		const screen = await render(
			<HabitDetailScreen
				id={habit.id}
				store={{
					loadHabitDetail: jest.fn(async () => ({
						habit,
						label: "10,000 steps",
						fromLocalDay: "2026-08-15",
						throughLocalDay: "2026-08-18",
						days: [
							{ localDay: "2026-08-15", state: "done" as const },
							{ localDay: "2026-08-16", state: "missed" as const },
							{
								localDay: "2026-08-17",
								state: "unscheduled" as const,
							},
							{ localDay: "2026-08-18", state: "no-data" as const },
						],
					})),
				}}
			/>,
		);

		expect(await screen.findByLabelText("2026-08-15: Done")).toBeTruthy();
		expect(screen.getByLabelText("2026-08-16: Missed")).toBeTruthy();
		expect(screen.getByLabelText("2026-08-17: Unscheduled")).toBeTruthy();
		expect(screen.getByLabelText("2026-08-18: No data")).toBeTruthy();
	});
});
