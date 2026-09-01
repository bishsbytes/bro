import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import { Platform } from "react-native";
import { DateField } from "./date-field";

const ORIGINAL_PLATFORM = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
	Object.defineProperty(Platform, "OS", { configurable: true, value: os });
}

function ControlledDateField() {
	const [date, setDate] = useState("");
	return (
		<DateField
			label="Target date (optional)"
			value={date}
			onChangeDate={setDate}
			allowClear
		/>
	);
}

describe("DateField", () => {
	afterEach(() => {
		setPlatform(ORIGINAL_PLATFORM);
		jest.restoreAllMocks();
	});

	it("chooses and clears a date through the native picker", async () => {
		const screen = await render(<ControlledDateField />);

		await fireEvent.press(screen.getByLabelText("Target date (optional)"));
		await fireEvent(
			screen.getByTestId("date-picker"),
			"valueChange",
			{ nativeEvent: { timestamp: Date.parse("2026-12-01T12:00:00Z") } },
			new Date(2026, 11, 1, 12),
		);
		await fireEvent.press(screen.getByText("Done"));

		expect(screen.getByText("2026-12-01")).toBeTruthy();
		expect(
			screen.getByLabelText("Target date (optional)").props.accessibilityValue,
		).toEqual({ text: "2026-12-01" });

		await fireEvent.press(screen.getByText("Clear date"));
		expect(screen.getByText("Choose date")).toBeTruthy();
	});

	it("opens the Android system dialog and returns its chosen day", async () => {
		setPlatform("android");
		const onChangeDate = jest.fn();
		const chosenDate = new Date(2026, 11, 25, 12);
		const open = jest
			.spyOn(DateTimePickerAndroid, "open")
			.mockImplementation((options) => {
				options.onValueChange?.(
					{
						nativeEvent: {
							timestamp: chosenDate.getTime(),
							utcOffset: chosenDate.getTimezoneOffset(),
						},
					},
					chosenDate,
				);
			});
		const screen = await render(
			<DateField label="Date" value="" onChangeDate={onChangeDate} />,
		);

		await fireEvent.press(screen.getByLabelText("Date"));

		expect(open).toHaveBeenCalledWith(
			expect.objectContaining({ mode: "date", display: "default" }),
		);
		expect(onChangeDate).toHaveBeenCalledWith("2026-12-25");
	});
});
