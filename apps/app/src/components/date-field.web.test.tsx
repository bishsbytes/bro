import { fireEvent, render } from "@testing-library/react-native";
import { DateField } from "./date-field.web";

describe("DateField on web", () => {
	it("uses the browser date input", async () => {
		const onChangeDate = jest.fn();
		const screen = await render(
			<DateField label="Date" value="" onChangeDate={onChangeDate} />,
		);
		const input = screen.getByLabelText("Date");

		expect(input.props.type).toBe("date");
		expect(input.props.style).toMatchObject({
			boxSizing: "border-box",
			width: "100%",
			height: 44,
			padding: "12px 16px",
			fontSize: 15,
		});
		await fireEvent(input, "change", { target: { value: "2026-12-01" } });
		expect(onChangeDate).toHaveBeenCalledWith("2026-12-01");
	});
});
