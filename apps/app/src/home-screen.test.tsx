import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { listFactors } from "./content/metric-registry";
import { HomeScreen } from "./screens/home-screen";
import { KILOGRAMS_PER_POUND } from "./units";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

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

function habitsStore() {
	return {
		loadToday: jest.fn(async () => emptyRoutines),
		toggleManual: jest.fn(async () => undefined),
		completeChallengeDay: jest.fn(),
	};
}

describe("home screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("shows the fast check-in", async () => {
		const screen = await render(
			<HomeScreen
				habitsStore={habitsStore()}
				store={{
					loadToday: jest.fn(async () => emptyToday),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		expect(await screen.findByLabelText("Mood 4")).toBeTruthy();
		expect(screen.queryByText("Measurements")).toBeNull();
		expect(await screen.findByText("Build a routine")).toBeTruthy();
		expect(screen.queryByText("Take stock of the bigger picture")).toBeNull();
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
		const routineStore = {
			loadToday: jest
				.fn()
				.mockResolvedValueOnce({
					...completed,
					habits: [{ ...completed.habits[0], completed: false, streak: 3 }],
				})
				.mockResolvedValue(completed),
			toggleManual,
			completeChallengeDay: jest.fn(),
		};
		const screen = await render(
			<HomeScreen
				habitsStore={routineStore}
				store={{
					loadToday: jest.fn(async () => emptyToday),
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
				habitsStore={habitsStore()}
				store={{ loadToday: jest.fn(async () => emptyToday), save }}
			/>,
		);
		await screen.findByLabelText("Mood 4");

		await fireEvent.press(screen.getByLabelText("Mood 4"));
		await fireEvent.press(screen.getByLabelText("Energy 3"));
		await fireEvent.press(screen.getByLabelText("Alcohol"));
		await fireEvent.press(screen.getByText("Save check-in"));

		await waitFor(() =>
			expect(save).toHaveBeenCalledWith(
				{
					mood: 4,
					energy: 3,
					selectedFactorSlugs: ["alcohol"],
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
				habitsStore={habitsStore()}
				store={{ loadToday: jest.fn(async () => measurementToday), save }}
			/>,
		);
		await screen.findByLabelText("Weight (st)");

		await fireEvent.press(screen.getByLabelText("Mood 4"));
		await fireEvent.press(screen.getByLabelText("Energy 3"));
		await fireEvent.changeText(
			screen.getByLabelText("Weight (st)"),
			"12 st 4 lb",
		);
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
				habitsStore={habitsStore()}
				store={{ loadToday: jest.fn(async () => measurementToday), save }}
			/>,
		);
		await screen.findByLabelText("Weight (st)");

		await fireEvent.press(screen.getByLabelText("Mood 4"));
		await fireEvent.press(screen.getByLabelText("Energy 3"));
		await fireEvent.changeText(screen.getByLabelText("Weight (st)"), "nope");
		await fireEvent.press(screen.getByText("Save check-in"));
		expect(await screen.findByText("Enter a valid measurement.")).toBeTruthy();
		expect(save).not.toHaveBeenCalled();

		screen.unmount();
		expect(save).not.toHaveBeenCalled();
	});
});
