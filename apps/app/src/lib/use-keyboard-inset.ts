/**
 * How far the keyboard reaches past the bottom safe-area inset, in points.
 *
 * Always zero here. On iOS `KeyboardAvoidingView` already lifts content off
 * the keyboard, and on web there is no soft keyboard to avoid. Android is the
 * platform that needs the number, and it has its own version of this file.
 */
export function useKeyboardInset(): number {
	return 0;
}
