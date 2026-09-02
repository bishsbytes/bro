import { render } from "@testing-library/react-native";
import { DeviceEventEmitter, Text } from "react-native";
import { useKeyboardInset } from "./use-keyboard-inset.android";

/**
 * The Android build of the hook, imported by its platform filename the way the
 * web component suites do — Jest resolves this project as iOS, where the hook
 * is the constant zero that leaves the keyboard to `KeyboardAvoidingView`.
 */
function Probe() {
	return <Text>{`inset ${useKeyboardInset()}`}</Text>;
}

/** What React Native reports when Android opens or closes the keyboard. */
function emitKeyboard(
	event: "keyboardDidShow" | "keyboardDidHide",
	height = 0,
) {
	DeviceEventEmitter.emit(event, {
		endCoordinates: { screenX: 0, screenY: 0, width: 400, height },
	});
}

describe("useKeyboardInset (Android)", () => {
	it("reports no inset while the keyboard is closed", async () => {
		const screen = await render(<Probe />);

		expect(screen.getByText("inset 0")).toBeTruthy();
	});

	it("reports the height the keyboard covers, and gives it back on close", async () => {
		const screen = await render(<Probe />);

		emitKeyboard("keyboardDidShow", 312);
		expect(await screen.findByText("inset 312")).toBeTruthy();

		emitKeyboard("keyboardDidHide");
		expect(await screen.findByText("inset 0")).toBeTruthy();
	});

	it("opens on a keyboard that is already up", async () => {
		// The Keyboard module tracks visibility from this same event, so the hook
		// can read the height of a keyboard that opened before it mounted.
		emitKeyboard("keyboardDidShow", 280);

		const screen = await render(<Probe />);

		expect(screen.getByText("inset 280")).toBeTruthy();
		emitKeyboard("keyboardDidHide");
	});
});
