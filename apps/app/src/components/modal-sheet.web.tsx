import {
	type PropsWithChildren,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	AccessibilityInfo,
	Animated,
	Easing,
	Modal,
	Pressable,
	ScrollView,
	type StyleProp,
	useWindowDimensions,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

type ModalSheetProps = PropsWithChildren<{
	visible: boolean;
	onClose: () => void;
	closeAccessibilityLabel: string;
}>;

function usePrefersReducedMotion() {
	const [reducedMotion, setReducedMotion] = useState<boolean>();

	useEffect(() => {
		let active = true;
		void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
			if (active) setReducedMotion(enabled);
		});
		const subscription = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			setReducedMotion,
		);

		return () => {
			active = false;
			subscription?.remove();
		};
	}, []);

	return reducedMotion;
}

export function ModalSheet({
	visible,
	onClose,
	closeAccessibilityLabel,
	children,
}: ModalSheetProps) {
	const { theme } = useUnistyles();
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();
	const reducedMotion = usePrefersReducedMotion();
	const progress = useRef(new Animated.Value(0)).current;
	const [mounted, setMounted] = useState(visible);

	useEffect(() => {
		if (visible) setMounted(true);
	}, [visible]);

	useEffect(() => {
		if (!mounted || reducedMotion === undefined) return;

		const animation = Animated.timing(progress, {
			toValue: visible ? 1 : 0,
			duration: reducedMotion ? 0 : theme.motion.duration,
			easing: Easing.bezier(0.2, 0.6, 0.3, 1),
			useNativeDriver: true,
		});
		animation.start(({ finished }) => {
			if (finished && !visible) setMounted(false);
		});

		return () => animation.stop();
	}, [mounted, progress, reducedMotion, theme.motion.duration, visible]);

	const requestClose = useCallback(() => {
		onClose();
	}, [onClose]);

	if (!mounted) return null;

	const maxHeight = Math.floor(windowHeight * 0.9);
	const sheetPosition: StyleProp<ViewStyle> = {
		maxHeight,
		paddingBottom: insets.bottom,
		transform: [
			{
				translateY: progress.interpolate({
					inputRange: [0, 1],
					outputRange: [maxHeight, 0],
				}),
			},
		],
	};

	return (
		<Modal
			animationType="none"
			transparent
			visible
			onRequestClose={requestClose}
		>
			<View accessibilityViewIsModal style={styles.overlay}>
				<Animated.View
					testID="modal-sheet-web-backdrop"
					style={[styles.backdrop, { opacity: progress }]}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={closeAccessibilityLabel}
						style={styles.fill}
						onPress={requestClose}
					/>
				</Animated.View>
				<Animated.View
					testID="modal-sheet-web"
					role="dialog"
					style={[styles.sheet, sheetPosition]}
				>
					<View style={styles.handleArea}>
						<View style={styles.handle} />
					</View>
					<ScrollView
						keyboardDismissMode="interactive"
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
						contentContainerStyle={styles.content}
					>
						{children}
					</ScrollView>
				</Animated.View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create((theme) => ({
	overlay: { flex: 1 },
	fill: { flex: 1 },
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: theme.colors.scrim,
	},
	sheet: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		overflow: "hidden",
		borderTopLeftRadius: theme.radius.sheet,
		borderTopRightRadius: theme.radius.sheet,
		borderWidth: 1,
		borderColor: theme.colors.line,
		backgroundColor: theme.colors.glass,
	},
	handleArea: {
		height: 24,
		alignItems: "center",
		justifyContent: "center",
	},
	handle: {
		width: 36,
		height: 4,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.lineStrong,
	},
	content: {
		gap: theme.spacing.lg,
		paddingTop: theme.spacing.sm,
		paddingHorizontal: theme.spacing.lg,
		paddingBottom: theme.spacing.lg,
	},
}));
