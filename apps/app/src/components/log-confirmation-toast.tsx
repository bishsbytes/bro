import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Button } from "./button";

const DISPLAY_DURATION_MS = 5_000;

export function LogConfirmationToast({
	message,
	actionLabel,
	onDismiss,
	onAction,
}: {
	message: string | null;
	actionLabel: string;
	onDismiss: () => void;
	onAction: () => void;
}) {
	const { theme } = useUnistyles();
	const insets = useSafeAreaInsets();

	useEffect(() => {
		if (!message) return;
		const timeout = setTimeout(onDismiss, DISPLAY_DURATION_MS);
		return () => clearTimeout(timeout);
	}, [message, onDismiss]);

	if (!message) return null;

	return (
		<View
			pointerEvents="box-none"
			style={[styles.overlay, { bottom: insets.bottom + theme.spacing.lg }]}
		>
			<View accessibilityLiveRegion="polite" style={styles.toast}>
				<MaterialIcons
					name="check-circle"
					color={theme.colors.brand}
					size={24}
				/>
				<AppText style={styles.message}>{message}</AppText>
				<Button
					label={actionLabel}
					variant="text"
					style={styles.action}
					onPress={() => {
						onDismiss();
						onAction();
					}}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	overlay: {
		position: "absolute",
		left: theme.spacing.lg,
		right: theme.spacing.lg,
		zIndex: 20,
		elevation: 10,
	},
	toast: {
		minHeight: 64,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		paddingLeft: theme.spacing.md,
		paddingRight: theme.spacing.xs,
		paddingVertical: theme.spacing.xs,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	message: { flex: 1 },
	action: {
		minHeight: 44,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
	},
}));
