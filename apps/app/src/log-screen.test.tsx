import { KILOGRAMS_PER_POUND } from "@bro/domain";
import { fireEvent, render } from "@testing-library/react-native";
import type { BodyOverview } from "./body/body-store";
import type { DrinkDaySnapshot } from "./drinks/drinks-store";
import type { FoodDaySnapshot } from "./food/food-store";
import { i18n } from "./i18n";
import { LogScreen } from "./screens/log/log-screen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	router: { push: (...args: unknown[]) => mockPush(...args) },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

jest.mock("react-native-safe-area-context", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		SafeAreaView: ({
			edges = [],
			...props
		}: {
			edges?: readonly string[];
			children?: React.ReactNode;
		}) =>
			React.createElement(View, {
				...props,
				testID: `safe-area-${edges.join("-")}`,
			}),
	};
});

const emptyDay = { entries: [], metrics: [] };
const drinksStore = {
	loadToday: jest.fn(async () => emptyDay as unknown as DrinkDaySnapshot),
};
const foodStore = {
	loadToday: jest.fn(async () => emptyDay as unknown as FoodDaySnapshot),
};

function weightOverview(tracked: boolean): BodyOverview {
	return {
		inputLocale: "en-GB",
		metrics: [
			{
				metricSlug: "weight",
				label: "Weight",
				dimension: "mass",
				displayUnit: "st",
				userEnterable: true,
				editablePresentation: {
					metricSlug: "weight",
					label: "Weight",
					dimension: "mass",
					displayUnit: "st",
				},
				tracked,
				visible: true,
				hasImportedData: false,
				position: 0,
				latest: null,
				latestFormatted: null,
				series: { observedDayCount: 0 },
				activeGoal: null,
			},
		],
	} as unknown as BodyOverview;
}

describe("Log screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("leads with today's food and drink totals and opens each logger", async () => {
		const screen = await render(
			<LogScreen
				bodyStore={{
					loadOverview: jest.fn(
						async () => ({ metrics: [], inputLocale: "en-GB" }) as BodyOverview,
					),
					setTracked: jest.fn(),
					recordMeasurement: jest.fn(),
				}}
				drinksStore={{
					loadToday: jest.fn(
						async () =>
							({
								entries: [{ entry: { id: "drink-1" } }],
								metrics: [
									{
										metric: { slug: "fluid_intake", label: "Fluid" },
										dayFormatted: "1.5 L",
									},
								],
							}) as unknown as DrinkDaySnapshot,
					),
				}}
				foodStore={{
					loadToday: jest.fn(
						async () =>
							({
								entries: [],
								metrics: [
									{
										metric: { slug: "protein_intake", label: "Protein" },
										dayFormatted: "82.0 g",
									},
								],
							}) as unknown as FoodDaySnapshot,
					),
				}}
			/>,
		);

		expect(await screen.findByText("1.5 L")).toBeTruthy();
		expect(screen.getByText("82.0 g")).toBeTruthy();
		expect(screen.getByText("1 entry")).toBeTruthy();

		await fireEvent.press(screen.getByLabelText("Open Drinks"));
		expect(mockPush).toHaveBeenLastCalledWith("/drinks");
		await fireEvent.press(screen.getByLabelText("Open Food"));
		expect(mockPush).toHaveBeenLastCalledWith("/food");
	});

	it("records a tracked measurement in canonical units", async () => {
		const recordMeasurement = jest.fn(async () => weightOverview(true));
		const screen = await render(
			<LogScreen
				bodyStore={{
					loadOverview: jest.fn(async () => weightOverview(true)),
					setTracked: jest.fn(),
					recordMeasurement,
				}}
				drinksStore={drinksStore}
				foodStore={foodStore}
			/>,
		);

		await fireEvent.changeText(
			await screen.findByLabelText("Weight (stones)"),
			"12",
		);
		await fireEvent.changeText(screen.getByLabelText("Weight (pounds)"), "4");
		await fireEvent.press(screen.getByLabelText("Log Weight"));

		expect(recordMeasurement).toHaveBeenCalledWith(
			"weight",
			172 * KILOGRAMS_PER_POUND,
		);
		expect(screen.getByLabelText("Weight (stones)").props.value).toBe("");
	});

	it("shows a field error and writes nothing for unparseable input", async () => {
		i18n.addResourceBundle(
			"en",
			"validation",
			{ measurement: { invalid: "Use a translated measurement value." } },
			true,
			true,
		);
		const recordMeasurement = jest.fn(async () => weightOverview(true));
		try {
			const screen = await render(
				<LogScreen
					bodyStore={{
						loadOverview: jest.fn(async () => weightOverview(true)),
						setTracked: jest.fn(),
						recordMeasurement,
					}}
					drinksStore={drinksStore}
					foodStore={foodStore}
				/>,
			);

			await fireEvent.changeText(
				await screen.findByLabelText("Weight (stones)"),
				"heavy",
			);
			await fireEvent.press(screen.getByLabelText("Log Weight"));

			expect(recordMeasurement).not.toHaveBeenCalled();
			expect(
				screen.getByText("Use a translated measurement value."),
			).toBeTruthy();
		} finally {
			i18n.addResourceBundle(
				"en",
				"validation",
				{ measurement: { invalid: "Enter a valid measurement." } },
				true,
				true,
			);
		}
	});

	it("offers entry only once a measurement is tracked", async () => {
		const screen = await render(
			<LogScreen
				bodyStore={{
					loadOverview: jest.fn(async () => weightOverview(false)),
					setTracked: jest.fn(),
					recordMeasurement: jest.fn(),
				}}
				drinksStore={drinksStore}
				foodStore={foodStore}
			/>,
		);

		expect(await screen.findByLabelText("Track Weight")).toBeTruthy();
		expect(screen.queryByLabelText("Weight (stones)")).toBeNull();
		expect(screen.queryByLabelText("Log Weight")).toBeNull();
	});

	it("leaves the bottom safe area to the tab navigator", async () => {
		const screen = await render(
			<LogScreen
				bodyStore={{
					loadOverview: jest.fn(
						async () => ({ metrics: [], inputLocale: "en-GB" }) as BodyOverview,
					),
					setTracked: jest.fn(),
					recordMeasurement: jest.fn(),
				}}
				drinksStore={{
					loadToday: jest.fn(
						async () =>
							({ entries: [], metrics: [] }) as unknown as DrinkDaySnapshot,
					),
				}}
				foodStore={{
					loadToday: jest.fn(
						async () =>
							({ entries: [], metrics: [] }) as unknown as FoodDaySnapshot,
					),
				}}
			/>,
		);

		expect(await screen.findByTestId("safe-area-")).toBeTruthy();
		expect(screen.queryByTestId("safe-area-bottom")).toBeNull();
	});
});
