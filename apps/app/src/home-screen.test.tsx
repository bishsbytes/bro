import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { listFactors } from "./content/metric-registry";
import { HomeScreen } from "./screens/home-screen";
import { KILOGRAMS_PER_POUND } from "./units";

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

describe("home screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("shows the fast check-in", async () => {
		const screen = await render(
			<HomeScreen
				store={{
					loadToday: jest.fn(async () => emptyToday),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		expect(await screen.findByLabelText("Mood 4")).toBeTruthy();
		expect(screen.queryByText("Measurements")).toBeNull();
	});

	it("saves after mood, energy, and one factor selection", async () => {
		const save = jest.fn(async () => emptyToday);
		const screen = await render(
			<HomeScreen
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
		const save = jest.fn(async (_draft: unknown, _entry: unknown) =>
			measurementToday,
		);
		const screen = await render(
			<HomeScreen
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
