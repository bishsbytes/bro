import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { UnitsScreen } from "./screens/settings/units-screen";
import type { UnitSettingsSnapshot } from "./units/unit-settings-store";

jest.mock("expo-router", () => ({
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

const localeSnapshot: UnitSettingsSnapshot = {
	settings: [
		{
			dimension: "mass",
			title: "Weight",
			description: "Used for weight entries, history, trends, and goals.",
			options: [
				{ unit: "kg", label: "Kilograms" },
				{ unit: "lb", label: "Pounds" },
				{ unit: "st", label: "Stones & pounds" },
			],
			resolvedUnit: "st",
			explicitUnit: null,
			resolutionSource: "locale",
			preview: "12 st 4 lb",
		},
		{
			dimension: "height",
			title: "Height",
			description: "Used for height measurements.",
			options: [
				{ unit: "cm", label: "Centimetres" },
				{ unit: "ft", label: "Feet & inches" },
			],
			resolvedUnit: "ft",
			explicitUnit: null,
			resolutionSource: "locale",
			preview: "5 ft 7 in",
		},
		{
			dimension: "length",
			title: "Other body measurements",
			description: "Used for waist and other circumference measurements.",
			options: [
				{ unit: "cm", label: "Centimetres" },
				{ unit: "in", label: "Inches" },
			],
			resolvedUnit: "cm",
			explicitUnit: null,
			resolutionSource: "locale",
			preview: "84.0 cm",
		},
		{
			dimension: "fraction",
			title: "Body fat",
			description: "Body fat is always displayed as a percentage.",
			options: [{ unit: "%", label: "Percent" }],
			resolvedUnit: "%",
			explicitUnit: null,
			resolutionSource: "locale",
			preview: "18.5%",
		},
	],
};

describe("units screen", () => {
	it("glimpses the resolved unit and its example on each row", async () => {
		const store = {
			load: jest.fn(async () => localeSnapshot),
			set: jest.fn(),
			loadWeekStart: jest.fn(async () => "monday" as const),
			setWeekStart: jest.fn(),
		};
		const view = await render(<UnitsScreen store={store} />);

		await waitFor(() =>
			expect(view.getByText("Example: 12 st 4 lb")).toBeTruthy(),
		);
		expect(view.getByText("Stones & pounds")).toBeTruthy();
		expect(view.getByText("Feet & inches")).toBeTruthy();
		expect(view.getByText("Monday")).toBeTruthy();
		expect(store.set).not.toHaveBeenCalled();
	});

	it("says where an unchosen unit came from without marking it as saved", async () => {
		const store = {
			load: jest.fn(async () => localeSnapshot),
			set: jest.fn(),
			loadWeekStart: jest.fn(async () => "monday" as const),
			setWeekStart: jest.fn(),
		};
		const view = await render(<UnitsScreen store={store} />);

		await fireEvent.press(
			await view.findByLabelText("Choose the unit for Weight"),
		);

		expect(view.getByText(/Device default: Stones & pounds/)).toBeTruthy();
		expect(
			view.getByText("Used for weight entries, history, trends, and goals."),
		).toBeTruthy();
		// The locale resolved it, so no option is shown as the saved one.
		expect(
			view.getByLabelText("Use Stones & pounds for Weight").props
				.accessibilityState,
		).toMatchObject({ selected: false });
		expect(store.set).not.toHaveBeenCalled();
	});

	it("persists a choice and replaces the preview immediately", async () => {
		const kilogramSnapshot: UnitSettingsSnapshot = {
			settings: localeSnapshot.settings.map((setting) =>
				setting.dimension === "mass"
					? {
							...setting,
							resolvedUnit: "kg",
							explicitUnit: "kg",
							resolutionSource: "explicit",
							preview: "78.0 kg",
						}
					: setting,
			),
		};
		const store = {
			load: jest.fn(async () => localeSnapshot),
			set: jest.fn(async () => kilogramSnapshot),
			loadWeekStart: jest.fn(async () => "monday" as const),
			setWeekStart: jest.fn(),
		};
		const view = await render(<UnitsScreen store={store} />);

		await fireEvent.press(
			await view.findByLabelText("Choose the unit for Weight"),
		);
		await fireEvent.press(view.getByLabelText("Use Kilograms for Weight"));

		await waitFor(() => expect(store.set).toHaveBeenCalledWith("mass", "kg"));
		// Choosing answers the row, so the sheet closes and the row carries it.
		expect(view.queryByLabelText("Use Kilograms for Weight")).toBeNull();
		expect(view.getByText("Kilograms")).toBeTruthy();
		expect(view.getByText("Example: 78.0 kg")).toBeTruthy();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("persists a week-start choice and updates the selection", async () => {
		const store = {
			load: jest.fn(async () => localeSnapshot),
			set: jest.fn(),
			loadWeekStart: jest.fn(async () => "monday" as const),
			setWeekStart: jest.fn(async () => undefined),
		};
		const view = await render(<UnitsScreen store={store} />);

		await fireEvent.press(
			await view.findByLabelText("Choose which day weeks start on"),
		);
		expect(
			view.getByLabelText("Start weeks on Monday").props.accessibilityState,
		).toMatchObject({ selected: true });

		await fireEvent.press(view.getByLabelText("Start weeks on Sunday"));

		await waitFor(() =>
			expect(store.setWeekStart).toHaveBeenCalledWith("sunday"),
		);
		expect(view.getByText("Sunday")).toBeTruthy();
	});
});
