import { KILOGRAMS_PER_POUND } from "@bro/domain";
import { listFactors } from "@bro/domain/metric-registry";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { Text } from "react-native";
import {
	monthHeaderLabel,
	TodayHeaderMonthProvider,
	useTodayHeaderMonth,
} from "./components/today-header-month-context";
import type { ReviewResult } from "./review/review-store";
import { HomeScreen } from "./screens/home/home-screen";

let triggerFocus: (() => void) | null = null;
let triggerTodayTabPress: (() => void) | null = null;

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		triggerFocus = () => {
			effect();
		};
		React.useEffect(effect, [effect]);
	},
	useScrollToTop: (ref: { current: { scrollToTop: () => void } | null }) => {
		const React = jest.requireActual("react");
		React.useEffect(() => {
			triggerTodayTabPress = () => ref.current?.scrollToTop();
			return () => {
				triggerTodayTabPress = null;
			};
		}, [ref]);
	},
}));

const FIXED_NOW = () => new Date(2026, 7, 14, 12);

const emptyToday = {
	localDay: "2026-08-14",
	entries: [],
	selectedFactorSlugs: [],
	availableFactors: listFactors(),
	availableMeasurements: [],
	loggedMeasurements: [],
	inputLocale: "en-GB",
	note: "",
};

const measurementToday = {
	...emptyToday,
	availableMeasurements: [
		{
			metricSlug: "weight" as const,
			label: "Weight",
			dimension: "mass" as const,
			displayUnit: "st" as const,
		},
	],
};

const emptyRoutines = {
	localDay: "2026-08-14",
	hasHabits: false,
	habits: [],
	challenges: [],
};

function wheelAt(completedAt: number): ReviewResult {
	return {
		assessment: {
			id: `review-${completedAt}`,
			templateSlug: "wheel-of-life",
			templateVersion: 1,
			startedAt: completedAt - 1_000,
			completedAt,
			items: [],
			focusItemSlugs: [],
			createdAt: completedAt,
			updatedAt: completedAt,
		},
		scores: [],
		previousAssessment: null,
		previousScores: [],
		comparisons: [],
	};
}

const manualHabit = {
	id: "habit-1",
	slug: "habit:reading",
	customLabel: null,
	kind: "manual" as const,
	areaSlug: null,
	metricSlug: null,
	direction: null,
	targetValue: null,
	daysOfWeek: 0b111_1111,
	position: 0,
	addedAt: 1,
	removedAt: null,
	createdAt: 1,
	updatedAt: 1,
};

function observation(metricSlug: string, value: number) {
	return {
		id: `${metricSlug}-1`,
		metricSlug,
		value,
		scaleMin: 1,
		scaleMax: 5,
		observedAt: Date.parse("2026-08-13T10:00:00.000Z"),
		localDay: "2026-08-13",
		tzOffsetMinutes: -60,
		source: "user",
		sourceRecordId: null,
		assessmentId: null,
		createdAt: 1,
		updatedAt: 1,
	};
}

function historyDay(localDay: string) {
	const mood = observation("mood", 2);
	const energy = observation("energy", 3);
	return {
		localDay,
		checkIns: [{ id: mood.id, observedAt: mood.observedAt, mood, energy }],
		unpairedScored: [],
		factors: [],
		assessments: [],
		measurements: [],
		unknown: [],
		notes: [],
		habitCompletions: [],
		challengeSteps: [],
	};
}

function habitsStore() {
	return {
		loadToday: jest.fn(async () => emptyRoutines),
		loadAdherenceRange: jest.fn(async () => []),
		toggleManual: jest.fn(async () => undefined),
		completeChallengeDay: jest.fn(),
	};
}

function supportingProps() {
	return {
		historyStore: {
			loadDay: jest.fn(async (localDay: string) => ({
				localDay,
				checkIns: [],
				unpairedScored: [],
				factors: [],
				assessments: [],
				measurements: [],
				unknown: [],
				notes: [],
				habitCompletions: [],
				challengeSteps: [],
			})),
		},
		unitSettingsStore: {
			loadWeekStart: jest.fn(async () => "monday" as const),
		},
		reviewStore: {
			loadLatestWheel: jest.fn(async () => null),
		},
		now: FIXED_NOW,
	};
}

function HeaderMonthProbe() {
	return <Text testID="header-month">{useTodayHeaderMonth()}</Text>;
}

describe("home screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		triggerFocus = null;
		triggerTodayTabPress = null;
	});

	it("shows the fast check-in", async () => {
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		expect(await screen.findByLabelText("Mood 4")).toBeTruthy();
		expect(screen.queryByText("Measurements")).toBeNull();
		expect(await screen.findByText("Build a routine")).toBeTruthy();
		expect(
			await screen.findByText("Take stock of the bigger picture"),
		).toBeTruthy();
	});

	it("hides the take-stock prompt after a recent wheel review", async () => {
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				reviewStore={{
					loadLatestWheel: jest.fn(async () =>
						wheelAt(Date.parse("2026-08-01T12:00:00Z")),
					),
				}}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		await screen.findByLabelText("Mood 4");
		await waitFor(() =>
			expect(screen.queryByText("Take stock of the bigger picture")).toBeNull(),
		);
	});

	it("shows the take-stock prompt when the latest review is stale", async () => {
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				reviewStore={{
					loadLatestWheel: jest.fn(async () =>
						wheelAt(Date.parse("2026-07-09T11:59:59Z")),
					),
				}}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		expect(
			await screen.findByText("Take stock of the bigger picture"),
		).toBeTruthy();
	});

	it("marks a manual habit complete from Today", async () => {
		const completed = {
			localDay: "2026-08-14",
			hasHabits: true,
			habits: [
				{
					habit: {
						id: "habit-1",
						slug: "habit:reading",
						customLabel: null,
						kind: "manual" as const,
						areaSlug: null,
						metricSlug: null,
						direction: null,
						targetValue: null,
						daysOfWeek: 0b111_1111,
						position: 0,
						addedAt: 1,
						removedAt: null,
						createdAt: 1,
						updatedAt: 1,
					},
					label: "Read",
					completed: true,
					streak: 4,
					progressLabel: null,
				},
			],
			challenges: [],
		};
		const toggleManual = jest.fn(async () => undefined);
		let todayLoadCount = 0;
		const routineStore = {
			loadToday: jest.fn(async (localDay?: string) => {
				if (localDay) return { ...emptyRoutines, localDay };
				todayLoadCount += 1;
				return todayLoadCount === 1
					? {
							...completed,
							habits: [{ ...completed.habits[0], completed: false, streak: 3 }],
						}
					: completed;
			}),
			loadAdherenceRange: jest.fn(async () => []),
			toggleManual,
			completeChallengeDay: jest.fn(),
		};
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				habitsStore={routineStore}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		expect(await screen.findByText("Read")).toBeTruthy();
		expect(screen.getByText(/3 day streak/)).toBeTruthy();
		await fireEvent.press(screen.getByText("Mark done"));

		await waitFor(() =>
			expect(toggleManual).toHaveBeenCalledWith("habit-1", "2026-08-14"),
		);
		expect(await screen.findByText(/4 day streak/)).toBeTruthy();
	});

	it("saves after mood, energy, and one factor selection", async () => {
		const save = jest.fn(async () => emptyToday);
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save,
				}}
			/>,
		);
		await screen.findByLabelText("Mood 4");

		await fireEvent.press(screen.getByLabelText("Mood 4"));
		await fireEvent.press(screen.getByLabelText("Energy 3"));
		await fireEvent.press(screen.getByLabelText("Training"));
		await fireEvent.press(screen.getByText("Save check-in"));

		await waitFor(() =>
			expect(save).toHaveBeenCalledWith(
				{
					mood: 4,
					energy: 3,
					selectedFactorSlugs: ["training"],
					measurements: [],
					note: "",
				},
				null,
			),
		);
	});

	it("parses an enabled measurement into a canonical draft value", async () => {
		const save = jest.fn(
			async (_draft: unknown, _entry: unknown) => measurementToday,
		);
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => measurementToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save,
				}}
			/>,
		);
		await screen.findByLabelText("Weight (stones)");

		await fireEvent.press(screen.getByLabelText("Mood 4"));
		await fireEvent.press(screen.getByLabelText("Energy 3"));
		await fireEvent.changeText(screen.getByLabelText("Weight (stones)"), "12");
		await fireEvent.changeText(screen.getByLabelText("Weight (pounds)"), "4");
		await fireEvent.press(screen.getByText("Save check-in"));

		await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
		expect(save.mock.calls[0]?.[0]).toMatchObject({
			measurements: [
				{
					metricSlug: "weight",
					value: 172 * KILOGRAMS_PER_POUND,
				},
			],
		});
	});

	it("shows a field error and writes nothing for abandoned measurement input", async () => {
		const save = jest.fn(async () => measurementToday);
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => measurementToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save,
				}}
			/>,
		);
		await screen.findByLabelText("Weight (stones)");

		await fireEvent.press(screen.getByLabelText("Mood 4"));
		await fireEvent.press(screen.getByLabelText("Energy 3"));
		await fireEvent.changeText(
			screen.getByLabelText("Weight (stones)"),
			"nope",
		);
		await fireEvent.press(screen.getByText("Save check-in"));
		expect(await screen.findByText("Enter a valid measurement.")).toBeTruthy();
		expect(save).not.toHaveBeenCalled();

		screen.unmount();
		expect(save).not.toHaveBeenCalled();
	});

	it("shows a past-day summary without the check-in form", async () => {
		const historyStore = {
			loadDay: jest.fn(async (localDay: string) => ({
				...historyDay(localDay),
				measurements: [
					{
						id: "heart-rate-1",
						metricSlug: "resting_heart_rate",
						label: "Resting heart rate",
						value: 55,
						formattedValue: "55 bpm",
						source: "health_connect",
						selected: true,
						observation: null,
						changeFromPreviousDay: {
							direction: "increase" as const,
							formattedDelta: "5 bpm",
							absolutePercentage: 10,
						},
					},
				],
			})),
		};
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				historyStore={historyStore}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		await fireEvent.press(
			await screen.findByTestId("week-strip-day-2026-08-13"),
		);

		expect(await screen.findByText("Yesterday")).toBeTruthy();
		expect(await screen.findByText("Mood 2 · Energy 3")).toBeTruthy();
		expect(screen.getByText("Resting heart rate")).toBeTruthy();
		expect(screen.getByText("55 bpm")).toBeTruthy();
		expect(screen.getByText("↑ 10%")).toBeTruthy();
		expect(screen.getByText("5 bpm higher than previous day")).toBeTruthy();
		expect(screen.queryByLabelText("Mood 4")).toBeNull();
		expect(screen.getByText("Edit this day")).toBeTruthy();
		expect(historyStore.loadDay).toHaveBeenCalledWith("2026-08-13");
	});

	it("refetches the visible past day after returning from an edit", async () => {
		let note = "before the edit";
		const historyStore = {
			loadDay: jest.fn(async (localDay: string) => ({
				...historyDay(localDay),
				notes: [
					{
						id: `note-${localDay}`,
						body: note,
						localDay,
						createdAt: 1_000,
						updatedAt: 1_000,
					},
				],
			})),
		};
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				historyStore={historyStore}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		await fireEvent.press(
			await screen.findByTestId("week-strip-day-2026-08-13"),
		);
		expect(await screen.findByText("before the edit")).toBeTruthy();

		// Standing in for the day being edited on the history screen while the
		// Today tab is blurred.
		note = "after the edit";
		await act(async () => {
			triggerFocus?.();
		});

		expect(await screen.findByText("after the edit")).toBeTruthy();
		expect(screen.queryByText("before the edit")).toBeNull();
	});

	it("stops refetching a past day that is already loaded", async () => {
		const historyStore = {
			loadDay: jest.fn(async (localDay: string) => historyDay(localDay)),
		};
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				historyStore={historyStore}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		await fireEvent.press(
			await screen.findByTestId("week-strip-day-2026-08-13"),
		);
		await screen.findByText("Yesterday");
		const loadsForYesterday = historyStore.loadDay.mock.calls.filter(
			([localDay]) => localDay === "2026-08-13",
		).length;

		await fireEvent.press(screen.getByTestId("week-strip-day-2026-08-14"));
		await fireEvent.press(screen.getByTestId("week-strip-day-2026-08-13"));
		await screen.findByText("Yesterday");

		expect(
			historyStore.loadDay.mock.calls.filter(
				([localDay]) => localDay === "2026-08-13",
			).length,
		).toBe(loadsForYesterday);
	});

	it("haptically pages between adjacent days without adding a future page", async () => {
		const historyStore = {
			loadDay: jest.fn(async (localDay: string) => historyDay(localDay)),
		};
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				historyStore={historyStore}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);
		await screen.findByLabelText("Mood 4");

		let pager = screen.getByTestId("today-day-pager");
		expect(pager.props.initialPage).toBe(1);
		expect(pager.props.pageCount).toBe(2);
		await fireEvent(pager, "pageScroll", {
			nativeEvent: { position: 0, offset: 0.51 },
		});
		expect(Haptics.selectionAsync).not.toHaveBeenCalled();
		expect(
			screen.getByTestId("week-strip-day-2026-08-14").props.accessibilityState
				.selected,
		).toBe(true);
		await fireEvent(pager, "pageScroll", {
			nativeEvent: { position: 0, offset: 0.49 },
		});
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
		expect(
			screen.getByTestId("week-strip-day-2026-08-13").props.accessibilityState
				.selected,
		).toBe(true);
		await fireEvent(pager, "pageSelected", {
			nativeEvent: { position: 0 },
		});

		expect(await screen.findByText("Yesterday")).toBeTruthy();
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
		expect(historyStore.loadDay).toHaveBeenCalledWith("2026-08-13");
		pager = screen.getByTestId("today-day-pager");
		expect(pager.props.initialPage).toBe(1);
		expect(pager.props.pageCount).toBe(3);
		await fireEvent(pager, "pageScroll", {
			nativeEvent: { position: 1, offset: 0.49 },
		});
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
		await fireEvent(pager, "pageScroll", {
			nativeEvent: { position: 1, offset: 0.51 },
		});
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
		expect(
			screen.getByTestId("week-strip-day-2026-08-14").props.accessibilityState
				.selected,
		).toBe(true);
		await fireEvent(pager, "pageSelected", {
			nativeEvent: { position: 2 },
		});

		expect(await screen.findByLabelText("Mood 4")).toBeTruthy();
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);

		pager = screen.getByTestId("today-day-pager");
		expect(pager.props.pageCount).toBe(2);
		await fireEvent(pager, "pageSelected", {
			nativeEvent: { position: 0 },
		});

		expect(await screen.findByText("Yesterday")).toBeTruthy();
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
	});

	it("updates the header month as earlier weeks become visible", async () => {
		const screen = await render(
			<TodayHeaderMonthProvider>
				<HeaderMonthProbe />
				<HomeScreen
					{...supportingProps()}
					habitsStore={habitsStore()}
					store={{
						loadToday: jest.fn(async () => emptyToday),
						loadCheckInDays: jest.fn(async () => new Set<string>()),
						save: jest.fn(async () => emptyToday),
					}}
				/>
			</TodayHeaderMonthProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("header-month").props.children).toBe(
				monthHeaderLabel("2026-08-13"),
			),
		);

		const strip = screen.getByTestId("week-strip");
		fireEvent(strip, "momentumScrollEnd", {
			nativeEvent: {
				contentOffset: { x: strip.props.getItemLayout(null, 2).offset, y: 0 },
			},
		});

		await waitFor(() =>
			expect(screen.getByTestId("header-month").props.children).toBe(
				monthHeaderLabel("2026-07-30"),
			),
		);
	});

	it("returns to today when the active Today tab is pressed again", async () => {
		const screen = await render(
			<TodayHeaderMonthProvider>
				<HeaderMonthProbe />
				<HomeScreen
					{...supportingProps()}
					habitsStore={habitsStore()}
					store={{
						loadToday: jest.fn(async () => emptyToday),
						loadCheckInDays: jest.fn(async () => new Set<string>()),
						save: jest.fn(async () => emptyToday),
					}}
				/>
			</TodayHeaderMonthProvider>,
		);

		await fireEvent.press(
			await screen.findByTestId("week-strip-day-2026-08-13"),
		);
		expect(await screen.findByText("Yesterday")).toBeTruthy();
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);

		const strip = screen.getByTestId("week-strip");
		fireEvent(strip, "momentumScrollEnd", {
			nativeEvent: {
				contentOffset: { x: strip.props.getItemLayout(null, 2).offset, y: 0 },
			},
		});
		await waitFor(() =>
			expect(screen.getByTestId("header-month").props.children).toBe(
				monthHeaderLabel("2026-07-30"),
			),
		);

		await act(async () => {
			triggerTodayTabPress?.();
		});
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);

		await waitFor(() =>
			expect(
				screen.getByTestId("week-strip-day-2026-08-14").props.accessibilityState
					.selected,
			).toBe(true),
		);
		expect(screen.queryByText("Yesterday")).toBeNull();
		expect(await screen.findByLabelText("Mood 4")).toBeTruthy();
		expect(screen.getByTestId("header-month").props.children).toBe(
			monthHeaderLabel("2026-08-13"),
		);
	});

	it("backfills yesterday's manual habit and refreshes its ring", async () => {
		let completed = false;
		const pastSnapshot = () => ({
			localDay: "2026-08-13",
			hasHabits: true,
			habits: [
				{
					habit: manualHabit,
					label: "Read",
					completed,
					streak: completed ? 1 : 0,
					progressLabel: null,
				},
			],
			challenges: [],
		});
		const toggleManual = jest.fn(async () => {
			completed = true;
		});
		const routineStore = {
			loadToday: jest.fn(async (localDay?: string) =>
				localDay === "2026-08-13" ? pastSnapshot() : emptyRoutines,
			),
			loadAdherenceRange: jest.fn(async () => [
				{
					localDay: "2026-08-13",
					scheduledCount: 1,
					completedCount: completed ? 1 : 0,
				},
			]),
			toggleManual,
			completeChallengeDay: jest.fn(),
		};
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				historyStore={{
					loadDay: jest.fn(async (localDay: string) => historyDay(localDay)),
				}}
				habitsStore={routineStore}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);
		const yesterday = await screen.findByTestId("week-strip-day-2026-08-13");
		await waitFor(() =>
			expect(yesterday.props.accessibilityLabel).toMatch(/0 of 1 habits done$/),
		);
		await fireEvent.press(yesterday);
		await fireEvent.press(await screen.findByText("Mark done"));

		await waitFor(() =>
			expect(toggleManual).toHaveBeenCalledWith("habit-1", "2026-08-13"),
		);
		await waitFor(() =>
			expect(
				screen.getByTestId("week-strip-day-2026-08-13").props
					.accessibilityLabel,
			).toMatch(/1 of 1 habits done$/),
		);
	});

	it("fills today's check-in dot after saving", async () => {
		let saved = false;
		const save = jest.fn(async () => {
			saved = true;
			return emptyToday;
		});
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					loadCheckInDays: jest.fn(async () =>
						saved ? new Set(["2026-08-14"]) : new Set<string>(),
					),
					save,
				}}
			/>,
		);
		await screen.findByLabelText("Mood 4");
		await fireEvent.press(screen.getByLabelText("Mood 4"));
		await fireEvent.press(screen.getByLabelText("Energy 3"));
		await fireEvent.press(screen.getByText("Save check-in"));

		await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
		await waitFor(() =>
			expect(
				screen.getByTestId("week-strip-day-2026-08-14").props
					.accessibilityLabel,
			).toMatch(/check-in logged/),
		);
	});

	it("reverts a stale today selection when an injected clock crosses midnight", async () => {
		let current = new Date(2026, 7, 14, 23, 59);
		const now = () => current;
		const screen = await render(
			<HomeScreen
				{...supportingProps()}
				now={now}
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => ({
						...emptyToday,
						localDay: current.getDate() === 14 ? "2026-08-14" : "2026-08-15",
					})),
					loadCheckInDays: jest.fn(async () => new Set<string>()),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);
		await waitFor(() =>
			expect(
				screen.getByTestId("week-strip-day-2026-08-14").props.accessibilityState
					.selected,
			).toBe(true),
		);
		await fireEvent.press(screen.getByTestId("week-strip-day-2026-08-14"));

		current = new Date(2026, 7, 15, 0, 1);
		await act(async () => {
			triggerFocus?.();
		});

		await waitFor(() =>
			expect(
				screen.getByTestId("week-strip-day-2026-08-15").props.accessibilityState
					.selected,
			).toBe(true),
		);
	});
});
