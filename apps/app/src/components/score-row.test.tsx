import { fireEvent, render } from "@testing-library/react-native";
import { MOOD_FACES } from "../check-in/check-in-presentation";
import { ScoreRow } from "./score-row";

describe("ScoreRow", () => {
	it("labels each score with the given prefix and reports the selection", async () => {
		const view = await render(
			<ScoreRow
				accessibilityPrefix="Energy"
				selected={3}
				onSelect={jest.fn()}
			/>,
		);

		expect(view.getByLabelText("Energy 1")).toBeTruthy();
		expect(view.getByLabelText("Energy 5")).toBeTruthy();
		expect(
			view.getByLabelText("Energy 3").props.accessibilityState.selected,
		).toBe(true);
		expect(
			view.getByLabelText("Energy 4").props.accessibilityState.selected,
		).toBe(false);
	});

	it("reports the chosen score", async () => {
		const onSelect = jest.fn();
		const view = await render(
			<ScoreRow
				accessibilityPrefix="Mood"
				selected={null}
				onSelect={onSelect}
			/>,
		);

		await fireEvent.press(view.getByLabelText("Mood 4"));
		expect(onSelect).toHaveBeenCalledWith(4);
	});

	it("renders a face per score when given faces", async () => {
		const view = await render(
			<ScoreRow
				accessibilityPrefix="Mood"
				selected={null}
				onSelect={jest.fn()}
				faces={MOOD_FACES}
			/>,
		);

		expect(view.getAllByTestId(/^score-face-/)).toHaveLength(MOOD_FACES.length);
		expect(view.getByLabelText("Mood 5")).toBeTruthy();
		expect(view.queryByText("5")).toBeNull();
	});

	it("ignores presses while disabled", async () => {
		const onSelect = jest.fn();
		const view = await render(
			<ScoreRow
				accessibilityPrefix="Mood"
				selected={2}
				onSelect={onSelect}
				disabled
			/>,
		);

		await fireEvent.press(view.getByLabelText("Mood 4"));
		expect(onSelect).not.toHaveBeenCalled();
		expect(
			view.getByLabelText("Mood 4").props.accessibilityState.disabled,
		).toBe(true);
	});
});
