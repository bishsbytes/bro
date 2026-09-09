import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import { SegmentedControl } from "./segmented-control";

const options = [
	{ value: "week", label: "Week" },
	{ value: "month", label: "Month" },
] as const;

describe("SegmentedControl", () => {
	it.each(["radio", "tab"] as const)(
		"changes one selection while preserving %s semantics",
		async (role) => {
			function Choice() {
				const [value, setValue] = useState("week");
				return (
					<SegmentedControl
						role={role}
						label="Period"
						options={options}
						value={value}
						onChange={setValue}
					/>
				);
			}
			const view = await render(<Choice />);
			const state = role === "tab" ? "selected" : "checked";
			expect(view.getByLabelText("Period").props.accessibilityRole).toBe(
				role === "tab" ? "tablist" : "radiogroup",
			);
			expect(
				view.getByRole(role, { name: "Week" }).props.accessibilityState[state],
			).toBe(true);
			await fireEvent.press(view.getByRole(role, { name: "Month" }));
			expect(
				view.getByRole(role, { name: "Week" }).props.accessibilityState[state],
			).toBe(false);
			expect(
				view.getByRole(role, { name: "Month" }).props.accessibilityState[state],
			).toBe(true);
		},
	);

	it("blocks changes while disabled without losing the selected value", async () => {
		const onChange = jest.fn();
		const view = await render(
			<SegmentedControl
				label="Period"
				options={options}
				value="week"
				disabled
				onChange={onChange}
			/>,
		);
		await fireEvent.press(view.getByRole("radio", { name: "Month" }));
		expect(onChange).not.toHaveBeenCalled();
		expect(
			view.getByRole("radio", { name: "Week" }).props.accessibilityState,
		).toMatchObject({
			checked: true,
			disabled: true,
		});
	});
});
