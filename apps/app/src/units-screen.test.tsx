import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { UnitsScreen } from "./screens/settings/units-screen";
import type { UnitSettingsSnapshot } from "./units/unit-settings-store";

jest.mock("expo-router", () => ({
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
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
	it("shows locale defaults as previews without marking them as saved", async () => {
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
		expect(view.getByText(/Device default: Stones & pounds/)).toBeTruthy();
		expect(view.getByLabelText("Use Feet & inches for Height")).toBeTruthy();
		expect(
			view.getByLabelText("Use Inches for Other body measurements"),
		).toBeTruthy();
		expect(
			view.getByLabelText("Use Stones & pounds for Weight").props
				.accessibilityState,
		).toMatchObject({ selected: false });
		expect(store.set).not.toHaveBeenCalled();
		expect(
			view.getByLabelText("Start weeks on Monday").props.accessibilityState,
		).toMatchObject({ selected: true });
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

		await waitFor(() =>
			expect(view.getByText("Example: 12 st 4 lb")).toBeTruthy(),
		);
		await fireEvent.press(view.getByLabelText("Use Kilograms for Weight"));

		await waitFor(() => expect(store.set).toHaveBeenCalledWith("mass", "kg"));
		expect(view.getByText("Example: 78.0 kg")).toBeTruthy();
		expect(
			view.getByLabelText("Use Kilograms for Weight").props.accessibilityState,
		).toMatchObject({ selected: true });
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

		await waitFor(() =>
			expect(view.getByLabelText("Start weeks on Sunday")).toBeTruthy(),
		);
		await fireEvent.press(view.getByLabelText("Start weeks on Sunday"));

		await waitFor(() =>
			expect(store.setWeekStart).toHaveBeenCalledWith("sunday"),
		);
		expect(
			view.getByLabelText("Start weeks on Sunday").props.accessibilityState,
		).toMatchObject({ selected: true });
	});
});
