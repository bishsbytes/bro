import { fireEvent, render } from "@testing-library/react-native";
import { TimeField } from "./time-field.web";

describe("TimeField on web", () => {
	it("uses an aligned browser time input", async () => {
		const onChangeTime = jest.fn();
		const screen = await render(
			<TimeField label="Time" value="20:00" onChangeTime={onChangeTime} />,
		);
		const input = screen.getByLabelText("Time");

		expect(input.props.type).toBe("time");
		expect(input.props.style).toMatchObject({
			boxSizing: "border-box",
			width: "100%",
			height: 44,
			padding: "12px 16px",
			fontSize: 15,
		});
		await fireEvent(input, "change", { target: { value: "07:45" } });
		expect(onChangeTime).toHaveBeenCalledWith("07:45");
	});
});
