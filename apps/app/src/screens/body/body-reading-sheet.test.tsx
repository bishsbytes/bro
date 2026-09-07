import { localDayOf } from "@bro/domain";
import { fireEvent, render } from "@testing-library/react-native";
import type { BodyMetricSummary } from "../../body/body-store";
import { BodyReadingSheet } from "./body-reading-sheet";

const metric = {
	metricSlug: "weight",
	label: "Weight",
	editablePresentation: {
		metricSlug: "weight",
		label: "Weight",
		dimension: "mass",
		displayUnit: "kg",
	},
} as BodyMetricSummary;

it("saves the decimal measurement with the displayed event date and time", async () => {
	const onSave = jest.fn();
	const view = await render(
		<BodyReadingSheet
			metric={metric}
			locale="en-GB"
			busy={false}
			error={null}
			onSave={onSave}
			onClose={jest.fn()}
		/>,
	);
	await fireEvent.changeText(view.getByLabelText("Weight (kg)"), "84.6");
	await fireEvent.press(view.getByLabelText("Date"));
	const day = new Date(2026, 8, 3, 12);
	await fireEvent(
		view.getByTestId("date-picker"),
		"valueChange",
		{ nativeEvent: { timestamp: day.getTime() } },
		day,
	);
	await fireEvent.press(view.getByText("Done"));
	await fireEvent.press(view.getByLabelText("Time"));
	const time = new Date(2026, 8, 3, 8, 12);
	await fireEvent(
		view.getByTestId("time-picker"),
		"valueChange",
		{ nativeEvent: { timestamp: time.getTime() } },
		time,
	);
	await fireEvent.press(view.getByText("Done"));
	await fireEvent.press(view.getByLabelText("Save reading"));
	expect(onSave).toHaveBeenCalledWith({
		metricSlug: "weight",
		canonicalValue: 84.6,
		observedAt: time.getTime(),
	});
	expect(localDayOf(new Date(onSave.mock.calls[0][0].observedAt))).toBe(
		"2026-09-03",
	);
});

it("keeps an invalid reading open without writing and allows cancellation", async () => {
	const onSave = jest.fn();
	const onClose = jest.fn();
	const view = await render(
		<BodyReadingSheet
			metric={metric}
			locale="en-GB"
			busy={false}
			error={null}
			onSave={onSave}
			onClose={onClose}
		/>,
	);
	await fireEvent.changeText(view.getByLabelText("Weight (kg)"), "heavy");
	await fireEvent.press(view.getByLabelText("Save reading"));
	expect(onSave).not.toHaveBeenCalled();
	expect(view.getByRole("alert")).toBeTruthy();
	await fireEvent.press(view.getByLabelText("Cancel"));
	expect(onClose).toHaveBeenCalledTimes(1);
});
