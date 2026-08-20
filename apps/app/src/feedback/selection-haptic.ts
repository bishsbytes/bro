import * as Haptics from "expo-haptics";

export function playSelectionHaptic(): void {
	void Haptics.selectionAsync().catch(() => undefined);
}
