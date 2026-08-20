import { fireEvent, render } from "@testing-library/react-native";
import type { BodyOverview } from "./body/body-store";
import type { DrinkDaySnapshot } from "./drinks/drinks-store";
import type { FoodDaySnapshot } from "./food/food-store";
import { LogScreen } from "./screens/log/log-screen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	router: { push: (...args: unknown[]) => mockPush(...args) },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

describe("Log screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("leads with today's food and drink totals and opens each logger", async () => {
		const screen = await render(
			<LogScreen
				bodyStore={{
					loadOverview: jest.fn(async () => ({ metrics: [] }) as BodyOverview),
					setTracked: jest.fn(),
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
});
