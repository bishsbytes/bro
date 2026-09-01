import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { DrinkSettingsSnapshot } from "./drinks/drinks-store";
import { DrinksSettingsScreen } from "./screens/settings/drinks-settings-screen";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

// The sheet reads insets; the screen itself still needs the real SafeAreaView.
jest.mock("react-native-safe-area-context", () => ({
	...jest.requireActual("react-native-safe-area-context"),
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

const snapshot: DrinkSettingsSnapshot = {
	metrics: [{ metricSlug: "alcohol_intake", label: "Alcohol", tracked: true }],
	units: [
		{
			dimension: "volume",
			title: "Volume",
			resolvedUnit: "ml",
			explicitUnit: null,
			preview: "568 ml",
			options: [
				{ unit: "ml", label: "Millilitres" },
				{ unit: "l", label: "Litres" },
			],
		},
	],
};

describe("drinks settings screen", () => {
	it("keeps a tracked toggle in its row and puts units behind a sheet", async () => {
		const store = {
			loadSettings: jest.fn(async () => snapshot),
			setTracked: jest.fn(async () => snapshot),
			setUnit: jest.fn(async () => ({
				...snapshot,
				units: [
					{
						...snapshot.units[0],
						resolvedUnit: "l" as const,
						explicitUnit: "l" as const,
						preview: "0.57 l",
					},
				],
			})),
		};
		const view = await render(<DrinksSettingsScreen store={store} />);

		// A single binary choice is already at its minimum, so it stays put.
		expect(await view.findByLabelText("Stop tracking Alcohol")).toBeTruthy();
		expect(view.getByText("Millilitres")).toBeTruthy();
		expect(view.queryByLabelText("Use Litres for Volume")).toBeNull();

		await fireEvent.press(view.getByLabelText("Choose the unit for Volume"));
		await fireEvent.press(view.getByLabelText("Use Litres for Volume"));

		await waitFor(() =>
			expect(store.setUnit).toHaveBeenCalledWith("volume", "l"),
		);
		expect(view.getByText("Litres")).toBeTruthy();
		expect(view.getByText("Example: 0.57 l")).toBeTruthy();
	});
});
