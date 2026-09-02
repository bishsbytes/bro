import { fireEvent, render } from "@testing-library/react-native";
import type { DrinkDaySnapshot } from "./drinks/drinks-store";
import type { FoodDaySnapshot } from "./food/food-store";
import { IntakeScreen } from "./screens/intake/intake-screen";
import type { NicotineStore } from "./substances/nicotine";

type NicotineDaySnapshot = Awaited<ReturnType<NicotineStore["loadToday"]>>;

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

function drinksStore(snapshot: unknown = emptyDay) {
	return { loadToday: jest.fn(async () => snapshot as DrinkDaySnapshot) };
}

function foodStore(snapshot: unknown = emptyDay) {
	return { loadToday: jest.fn(async () => snapshot as FoodDaySnapshot) };
}

function nicotineStore(tracked: boolean, snapshot: unknown = emptyDay) {
	return {
		isTracked: jest.fn(async () => tracked),
		loadToday: jest.fn(async () => snapshot as NicotineDaySnapshot),
	};
}

describe("Intake screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("leads with today's food and drink totals and opens each logger", async () => {
		const screen = await render(
			<IntakeScreen
				drinksStore={drinksStore({
					entries: [{ entry: { id: "drink-1" } }],
					metrics: [
						{
							metric: { slug: "fluid_intake", label: "Fluid" },
							dayFormatted: "1.5 L",
						},
						{
							metric: { slug: "energy_intake", label: "Energy intake" },
							dayFormatted: "2,100 kcal",
						},
					],
				})}
				foodStore={foodStore({
					entries: [],
					metrics: [
						{
							metric: { slug: "protein_intake", label: "Protein" },
							dayFormatted: "82.0 g",
						},
						{
							metric: { slug: "energy_intake", label: "Energy intake" },
							dayFormatted: "2,100 kcal",
						},
					],
				})}
				nicotineStore={nicotineStore(false)}
			/>,
		);

		expect(await screen.findByText("1.5 L")).toBeTruthy();
		expect(screen.getByText("82.0 g")).toBeTruthy();
		expect(screen.getByText("1 entry")).toBeTruthy();
		expect(screen.getAllByText("Drinks")).toHaveLength(1);
		expect(screen.getAllByText("Food")).toHaveLength(1);
		// Every stream feeds the same energy total, so the card states it once.
		expect(screen.getAllByText("ENERGY INTAKE")).toHaveLength(1);
		expect(screen.getAllByText("2,100 kcal")).toHaveLength(1);

		await fireEvent.press(screen.getByLabelText("Open Drinks"));
		expect(mockPush).toHaveBeenLastCalledWith("/drinks");
		await fireEvent.press(screen.getByLabelText("Open Food"));
		expect(mockPush).toHaveBeenLastCalledWith("/food");
	});

	it("offers smoking only once that stream is switched on", async () => {
		const untracked = nicotineStore(false);
		const screen = await render(
			<IntakeScreen
				drinksStore={drinksStore()}
				foodStore={foodStore()}
				nicotineStore={untracked}
			/>,
		);

		expect(await screen.findByLabelText("Open Food")).toBeTruthy();
		expect(screen.queryByText("Smoking & vaping")).toBeNull();
		// An unasked-for smoking row is the product having a view about its user,
		// so the day is not even read when the stream is off.
		expect(untracked.loadToday).not.toHaveBeenCalled();
	});

	it("shows a smoking row alongside food and drink once tracked", async () => {
		const screen = await render(
			<IntakeScreen
				drinksStore={drinksStore()}
				foodStore={foodStore()}
				nicotineStore={nicotineStore(true, {
					entries: [{ entry: { id: "nicotine-1" } }],
					metrics: [
						{
							metric: { slug: "nicotine_intake", label: "Nicotine" },
							dayFormatted: "12 mg",
						},
					],
				})}
			/>,
		);

		expect(await screen.findByText("Smoking & vaping")).toBeTruthy();
		expect(screen.getByText("12 mg")).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("Open Smoking & vaping"));
		expect(mockPush).toHaveBeenLastCalledWith("/nicotine");
	});

	it("leaves the bottom safe area to the tab navigator", async () => {
		const screen = await render(
			<IntakeScreen
				drinksStore={drinksStore()}
				foodStore={foodStore()}
				nicotineStore={nicotineStore(false)}
			/>,
		);

		expect(await screen.findByTestId("safe-area-")).toBeTruthy();
		expect(screen.queryByTestId("safe-area-bottom")).toBeNull();
	});
});
