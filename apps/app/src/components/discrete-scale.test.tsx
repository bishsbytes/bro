import { fireEvent, render } from "@testing-library/react-native";
import { DiscreteScale } from "./discrete-scale";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

describe("DiscreteScale", () => {
	it("renders ten stops as one adjustable control", async () => {
		const view = await render(
			<DiscreteScale
				accessibilityPrefix="Work & career"
				scores={SCORES}
				selected={6}
				onSelect={jest.fn()}
				endLabels={{ minimum: "Very low", maximum: "Very good" }}
			/>,
		);

		const scale = view.getByLabelText("Work & career score");
		expect(scale.props.accessibilityRole).toBe("adjustable");
		expect(scale.props.accessibilityValue).toEqual({ min: 1, max: 10, now: 6 });
		expect(view.getByText("1", { includeHiddenElements: true })).toBeTruthy();
		expect(view.getByText("10", { includeHiddenElements: true })).toBeTruthy();
		expect(view.getByText("Very low")).toBeTruthy();
		expect(view.getByText("Very good")).toBeTruthy();
	});

	it("maps native touches and web clicks against the full rail", async () => {
		const onSelect = jest.fn();
		const view = await render(
			<DiscreteScale
				accessibilityPrefix="Work & career"
				scores={SCORES}
				selected={null}
				onSelect={onSelect}
				endLabels={{ minimum: "Very low", maximum: "Very good" }}
			/>,
		);
		const scale = view.getByLabelText("Work & career score");
		// Pointer coordinates must be relative to the full rail. If a tick or
		// number becomes the browser event target, its small local X maps to 1.
		expect(
			view.getByTestId("discrete-scale-points", {
				includeHiddenElements: true,
			}).props.pointerEvents,
		).toBe("none");
		await fireEvent(scale, "layout", {
			nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 64 } },
		});
		await fireEvent.press(scale, {
			nativeEvent: { locationX: 176, locationY: 32 },
		});
		await fireEvent.press(scale, {
			nativeEvent: {
				locationX: undefined,
				offsetX: 240,
				locationY: 32,
			},
		});

		expect(onSelect).toHaveBeenNthCalledWith(1, 6);
		expect(onSelect).toHaveBeenNthCalledWith(2, 8);
	});

	it("supports screen-reader and keyboard adjustments", async () => {
		const onSelect = jest.fn();
		const view = await render(
			<DiscreteScale
				accessibilityPrefix="Work & career"
				scores={SCORES}
				selected={5}
				onSelect={onSelect}
				endLabels={{ minimum: "Very low", maximum: "Very good" }}
			/>,
		);
		const scale = view.getByLabelText("Work & career score");

		await fireEvent(scale, "accessibilityAction", {
			nativeEvent: { actionName: "increment" },
		});
		await fireEvent(scale, "accessibilityAction", {
			nativeEvent: { actionName: "decrement" },
		});
		const preventDefault = jest.fn();
		await fireEvent(scale, "keyDown", {
			nativeEvent: { key: "End" },
			preventDefault,
		});

		expect(onSelect).toHaveBeenNthCalledWith(1, 6);
		expect(onSelect).toHaveBeenNthCalledWith(2, 4);
		expect(onSelect).toHaveBeenNthCalledWith(3, 10);
		expect(preventDefault).toHaveBeenCalled();
	});
});
