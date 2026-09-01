import {
	fireEvent,
	type RenderResult,
	render,
} from "@testing-library/react-native";
import { DiscreteScale } from "./discrete-scale";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** The rail sits inside the control's padding and border, so its own box is
 *  what a pointer is measured against. */
const TRACK = { x: 5, y: 0, width: 310, height: 48 };

function scaleOf(props: Partial<Parameters<typeof DiscreteScale>[0]> = {}) {
	return (
		<DiscreteScale
			accessibilityPrefix="Work & career"
			scores={SCORES}
			selected={null}
			onSelect={jest.fn()}
			endLabels={{ minimum: "Very low", maximum: "Very good" }}
			{...props}
		/>
	);
}

async function layOut(view: RenderResult) {
	await fireEvent(
		view.getByTestId("discrete-scale-points", { includeHiddenElements: true }),
		"layout",
		{ nativeEvent: { layout: TRACK } },
	);
}

describe("DiscreteScale", () => {
	it("renders ten stops as one adjustable control", async () => {
		const view = await render(scaleOf({ selected: 6 }));

		const scale = view.getByLabelText("Work & career score");
		expect(scale.props.accessibilityRole).toBe("adjustable");
		expect(scale.props.accessibilityValue).toEqual({ min: 1, max: 10, now: 6 });
		expect(view.getByText("1", { includeHiddenElements: true })).toBeTruthy();
		expect(view.getByText("10", { includeHiddenElements: true })).toBeTruthy();
		expect(view.getByText("Very low")).toBeTruthy();
		expect(view.getByText("Very good")).toBeTruthy();
	});

	it("maps native touches and web clicks against the rail the stops sit on", async () => {
		const onSelect = jest.fn();
		const view = await render(scaleOf({ onSelect }));
		const scale = view.getByLabelText("Work & career score");
		// Pointer coordinates must be relative to the full rail. If a tick or
		// number becomes the browser event target, its small local X maps to 1.
		expect(
			view.getByTestId("discrete-scale-points", {
				includeHiddenElements: true,
			}).props.pointerEvents,
		).toBe("none");
		await layOut(view);

		// Dead centre of the sixth stop, measured from the control's own left
		// edge: the rail's 5px inset plus five and a half stops of 31px.
		await fireEvent.press(scale, {
			nativeEvent: { locationX: 5 + 5.5 * 31, locationY: 32 },
		});
		await fireEvent.press(scale, {
			nativeEvent: { locationX: undefined, offsetX: 5 + 7.5 * 31 },
		});

		expect(onSelect).toHaveBeenNthCalledWith(1, 6, "pointer");
		expect(onSelect).toHaveBeenNthCalledWith(2, 8, "pointer");
	});

	it("keeps the last stop reachable at the very end of the rail", async () => {
		const onSelect = jest.fn();
		const view = await render(scaleOf({ onSelect }));
		await layOut(view);

		const scale = view.getByLabelText("Work & career score");
		await fireEvent.press(scale, {
			nativeEvent: { locationX: TRACK.x + TRACK.width, locationY: 32 },
		});
		await fireEvent.press(scale, {
			nativeEvent: { locationX: 0, locationY: 32 },
		});

		expect(onSelect).toHaveBeenNthCalledWith(1, 10, "pointer");
		expect(onSelect).toHaveBeenNthCalledWith(2, 1, "pointer");
	});

	it("previews the stop under a drag without choosing it", async () => {
		const onSelect = jest.fn();
		const view = await render(scaleOf({ onSelect }));
		await layOut(view);
		const scale = view.getByLabelText("Work & career score");

		await fireEvent(scale, "pressIn", {
			nativeEvent: { locationX: 5 + 0.5 * 31, locationY: 32 },
		});
		await fireEvent(scale, "touchMove", {
			nativeEvent: { locationX: 5 + 8.5 * 31, locationY: 32 },
		});

		// The rail shows where the finger is, but nothing is chosen until it lifts.
		expect(onSelect).not.toHaveBeenCalled();
		await fireEvent(scale, "pressOut", {});
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("steps through neighbours for a screen reader without settling the answer", async () => {
		const onSelect = jest.fn();
		// A rail reports each step as an adjustment, so the caller can hold the
		// question open; committing on the first one would strand a screen
		// reader on whatever value it happened to touch first.
		const view = await render(scaleOf({ selected: 5, onSelect }));
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
		await fireEvent(scale, "keyDown", {
			nativeEvent: { key: "ArrowRight" },
			preventDefault,
		});

		expect(onSelect).toHaveBeenNthCalledWith(1, 6, "adjust");
		expect(onSelect).toHaveBeenNthCalledWith(2, 4, "adjust");
		expect(onSelect).toHaveBeenNthCalledWith(3, 10, "adjust");
		expect(onSelect).toHaveBeenNthCalledWith(4, 6, "adjust");
		expect(preventDefault).toHaveBeenCalledTimes(2);
	});

	it("settles on the walked-to score when a keyboard press names no stop", async () => {
		const onSelect = jest.fn();
		const view = await render(scaleOf({ selected: 7, onSelect }));
		await layOut(view);
		const scale = view.getByLabelText("Work & career score");

		// React Native Web runs Enter through a document keyup listener, which
		// hands onPress a bare DOM event with no nativeEvent of any kind.
		await fireEvent(scale, "pressIn", { type: "keydown" });
		await fireEvent(scale, "pressOut", { type: "keyup" });
		await fireEvent(scale, "press", { type: "keyup" });

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith(7, "pointer");
	});

	it("does nothing when a keyboard press has no score to settle on", async () => {
		const onSelect = jest.fn();
		const view = await render(scaleOf({ selected: null, onSelect }));
		await layOut(view);

		await fireEvent(view.getByLabelText("Work & career score"), "press", {
			type: "keyup",
		});
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("starts an unanswered scale from either end", async () => {
		const onSelect = jest.fn();
		const view = await render(scaleOf({ selected: null, onSelect }));
		const scale = view.getByLabelText("Work & career score");
		expect(scale.props.accessibilityValue).toEqual({ min: 1, max: 10 });

		await fireEvent(scale, "accessibilityAction", {
			nativeEvent: { actionName: "decrement" },
		});
		expect(onSelect).toHaveBeenNthCalledWith(1, 10, "adjust");
	});

	it("ignores every input while disabled", async () => {
		const onSelect = jest.fn();
		const view = await render(
			scaleOf({ selected: 3, onSelect, disabled: true }),
		);
		await layOut(view);
		const scale = view.getByLabelText("Work & career score");

		expect(scale.props.accessibilityState).toEqual({ disabled: true });
		await fireEvent.press(scale, {
			nativeEvent: { locationX: 5 + 5.5 * 31, locationY: 32 },
		});
		expect(onSelect).not.toHaveBeenCalled();
	});
});
