import { fireEvent, render } from "@testing-library/react-native";
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

	it("renders the word and height encoded Baseline mood scale", async () => {
		const view = await render(
			<ScoreRow
				accessibilityPrefix="Mood"
				selected={null}
				onSelect={jest.fn()}
				labels={["Low", "Flat", "Okay", "Good", "Sharp"]}
				varyHeight
			/>,
		);

		expect(view.getByText("Low")).toBeTruthy();
		expect(view.getByText("Sharp")).toBeTruthy();
		expect(view.getByLabelText("Mood 5")).toBeTruthy();
		expect(view.queryByText("5")).toBeNull();
	});

	it("shows what the two ends of the scale mean", async () => {
		const view = await render(
			<ScoreRow
				accessibilityPrefix="Mood"
				selected={null}
				onSelect={jest.fn()}
				endLabels={{ minimum: "Very bad", maximum: "Very good" }}
			/>,
		);

		expect(view.getByText("Very bad")).toBeTruthy();
		expect(view.getByText("Very good")).toBeTruthy();
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
