import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import { Platform } from "react-native";
import { TimeField } from "./time-field";

const ORIGINAL_PLATFORM = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
	Object.defineProperty(Platform, "OS", { configurable: true, value: os });
}

function ControlledTimeField() {
	const [time, setTime] = useState("20:00");
	return <TimeField label="Time" value={time} onChangeTime={setTime} />;
}

describe("TimeField", () => {
	afterEach(() => {
		setPlatform(ORIGINAL_PLATFORM);
		jest.restoreAllMocks();
	});

	it("chooses a time through the native picker", async () => {
		const screen = await render(<ControlledTimeField />);
		const chosenTime = new Date(2026, 0, 1, 7, 45);

		await fireEvent.press(screen.getByLabelText("Time"));
		await fireEvent(
			screen.getByTestId("time-picker"),
			"valueChange",
			{ nativeEvent: { timestamp: chosenTime.getTime() } },
			chosenTime,
		);
		await fireEvent.press(screen.getByText("Done"));

		expect(screen.getByText("07:45")).toBeTruthy();
		expect(screen.getByLabelText("Time").props.accessibilityValue).toEqual({
			text: "07:45",
		});
	});

	it("opens the Android 24-hour system dialog", async () => {
		setPlatform("android");
		const onChangeTime = jest.fn();
		const chosenTime = new Date(2026, 0, 1, 19, 15);
		const open = jest
			.spyOn(DateTimePickerAndroid, "open")
			.mockImplementation((options) => {
				options.onValueChange?.(
					{
						nativeEvent: {
							timestamp: chosenTime.getTime(),
							utcOffset: chosenTime.getTimezoneOffset(),
						},
					},
					chosenTime,
				);
			});
		const screen = await render(
			<TimeField label="Time" value="20:00" onChangeTime={onChangeTime} />,
		);

		await fireEvent.press(screen.getByLabelText("Time"));

		expect(open).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: "time",
				display: "default",
				is24Hour: true,
			}),
		);
		expect(onChangeTime).toHaveBeenCalledWith("19:15");
	});
});
