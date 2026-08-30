import BottomSheet, {
	BottomSheetBackdrop,
	type BottomSheetBackdropProps,
	BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { type PropsWithChildren, useCallback, useRef } from "react";
import { Modal, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

const EXPANDED_SNAP_POINT = ["90%"];

type ModalSheetProps = PropsWithChildren<{
	visible: boolean;
	onClose: () => void;
	closeAccessibilityLabel: string;
}>;

export function ModalSheet({
	visible,
	onClose,
	closeAccessibilityLabel,
	children,
}: ModalSheetProps) {
	const { theme } = useUnistyles();
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();
	const sheetRef = useRef<BottomSheet>(null);
	const maxDynamicContentSize = Math.floor(windowHeight * 0.9);

	const requestClose = useCallback(() => {
		if (sheetRef.current) {
			sheetRef.current.close();
			return;
		}
		onClose();
	}, [onClose]);

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				appearsOnIndex={0}
				disappearsOnIndex={-1}
				opacity={1}
				pressBehavior="close"
				style={[props.style, { backgroundColor: theme.colors.scrim }]}
			/>
		),
		[theme.colors.scrim],
	);
	if (!visible) {
		return null;
	}

	return (
		<Modal
			animationType="none"
			transparent
			visible
			onRequestClose={requestClose}
		>
			<GestureHandlerRootView accessibilityViewIsModal style={styles.overlay}>
				<BottomSheet
					ref={sheetRef}
					accessibilityLabel={closeAccessibilityLabel}
					android_keyboardInputMode="adjustResize"
					backdropComponent={renderBackdrop}
					backgroundStyle={styles.sheetBackground}
					enableBlurKeyboardOnGesture
					enableDynamicSizing
					enablePanDownToClose
					handleIndicatorStyle={styles.handle}
					index={0}
					keyboardBehavior="interactive"
					keyboardBlurBehavior="restore"
					maxDynamicContentSize={maxDynamicContentSize}
					snapPoints={EXPANDED_SNAP_POINT}
					topInset={insets.top}
					onClose={onClose}
				>
					<BottomSheetScrollView
						bounces={false}
						keyboardDismissMode="interactive"
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
						contentContainerStyle={[
							styles.content,
							{ paddingBottom: insets.bottom + theme.spacing.lg },
						]}
					>
						{children}
					</BottomSheetScrollView>
				</BottomSheet>
			</GestureHandlerRootView>
		</Modal>
	);
}

const styles = StyleSheet.create((theme) => ({
	overlay: { flex: 1 },
	sheetBackground: {
		borderTopLeftRadius: theme.radius.lg,
		borderTopRightRadius: theme.radius.lg,
		backgroundColor: theme.colors.background,
	},
	handle: {
		width: 40,
		height: 4,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.border,
	},
	content: {
		gap: theme.spacing.lg,
		paddingTop: theme.spacing.lg,
		paddingHorizontal: theme.spacing.lg,
	},
}));
