import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { UnitsScreen } from "./screens/settings/units-screen";
import type { UnitSettingsSnapshot } from "./units/unit-settings-store";

jest.mock("expo-router", () => ({
	useFocusEffect: (effect: () => void | (() => void)) => {
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
			dimension: "length",
			title: "Length",
			description: "Used for waist measurements.",
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
		};
		const view = await render(<UnitsScreen store={store} />);

		await waitFor(() =>
			expect(view.getByText("Example: 12 st 4 lb")).toBeTruthy(),
		);
		expect(view.getByText(/Device default: Stones & pounds/)).toBeTruthy();
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
});
