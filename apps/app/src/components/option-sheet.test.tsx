import { fireEvent, render } from "@testing-library/react-native";
import { OptionSheet } from "./option-sheet";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

const UNITS = [
	{ value: "kg", label: "Kilograms", accessibilityLabel: "Use Kilograms" },
	{ value: "lb", label: "Pounds", accessibilityLabel: "Use Pounds" },
] as const;

describe("OptionSheet", () => {
	it("answers a single choice and dismisses itself", async () => {
		const onSelect = jest.fn();
		const onClose = jest.fn();
		const view = await render(
			<OptionSheet
				visible
				title="Weight"
				intro="Used for weight entries."
				note="Device default: Pounds."
				closeAccessibilityLabel="Close Weight options"
				options={UNITS}
				selected="lb"
				onSelect={onSelect}
				onClose={onClose}
			/>,
		);

		expect(view.getByText("Used for weight entries.")).toBeTruthy();
		expect(view.getByText("Device default: Pounds.")).toBeTruthy();
		const chosen = view.getByLabelText("Use Pounds");
		expect(chosen.props.accessibilityRole).toBe("radio");
		expect(chosen.props.accessibilityState.selected).toBe(true);

		await fireEvent.press(view.getByLabelText("Use Kilograms"));

		expect(onSelect).toHaveBeenCalledWith("kg");
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("stays open while a group is toggled", async () => {
		const onSelect = jest.fn();
		const onClose = jest.fn();
		const view = await render(
			<OptionSheet
				visible
				selection="multiple"
				title="Lifestyle"
				closeAccessibilityLabel="Close Lifestyle tags"
				options={UNITS}
				selected={["lb"]}
				onSelect={onSelect}
				onClose={onClose}
			/>,
		);

		const toggled = view.getByLabelText("Use Pounds");
		expect(toggled.props.accessibilityRole).toBe("checkbox");
		expect(toggled.props.accessibilityState.checked).toBe(true);

		await fireEvent.press(view.getByLabelText("Use Kilograms"));

		expect(onSelect).toHaveBeenCalledWith("kg");
		expect(onClose).not.toHaveBeenCalled();
	});

	it("ignores a choice while a write is in flight", async () => {
		const onSelect = jest.fn();
		const view = await render(
			<OptionSheet
				visible
				title="Weight"
				closeAccessibilityLabel="Close Weight options"
				options={UNITS}
				selected="lb"
				disabled
				onSelect={onSelect}
				onClose={jest.fn()}
			/>,
		);

		await fireEvent.press(view.getByLabelText("Use Kilograms"));

		expect(onSelect).not.toHaveBeenCalled();
	});
});
