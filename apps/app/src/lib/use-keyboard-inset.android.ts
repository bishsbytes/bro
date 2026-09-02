import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * How far the keyboard reaches past the bottom safe-area inset, in points.
 *
 * Edge-to-edge display stops `android:windowSoftInputMode="adjustResize"` from
 * resizing the window, so the keyboard opens *over* the screen and nothing
 * moves out of its way on its own. Add this to the bottom padding of whatever
 * has to stay reachable while typing.
 *
 * React Native reports the height with the system bars already taken out of it
 * — the navigation bar sits over the keyboard — so this is exactly the room
 * still owed on top of the safe-area inset a screen already pads for.
 */
export function useKeyboardInset(): number {
	const [inset, setInset] = useState(
		() => (Keyboard.isVisible() ? Keyboard.metrics()?.height : 0) ?? 0,
	);

	useEffect(() => {
		// Android has no "will show" event, so the lift lands once the keyboard
		// has finished opening rather than travelling up with it.
		const shown = Keyboard.addListener("keyboardDidShow", (event) => {
			setInset(event.endCoordinates.height);
		});
		const hidden = Keyboard.addListener("keyboardDidHide", () => {
			setInset(0);
		});
		return () => {
			shown.remove();
			hidden.remove();
		};
	}, []);

	return inset;
}
