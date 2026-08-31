import type { ComponentProps } from "react";
import { TouchableOpacity } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { LoadingIndicator } from "./loading-indicator";

type ButtonVariant = "primary" | "secondary" | "danger" | "text";
type ButtonTone = "default" | "danger";

type ButtonProps = Omit<ComponentProps<typeof TouchableOpacity>, "children"> & {
	label: string;
	variant?: ButtonVariant;
	tone?: ButtonTone;
	loading?: boolean;
};

export function Button({
	label,
	variant = "primary",
	tone = "default",
	loading = false,
	disabled = false,
	accessibilityLabel = label,
	style,
	...props
}: ButtonProps) {
	const { theme } = useUnistyles();
	const blocked = disabled || loading;
	const dangerTone = tone === "danger" || variant === "danger";
	const foreground =
		variant === "primary"
			? theme.colors.onAccent
			: variant === "danger"
				? theme.colors.alert
				: dangerTone
					? theme.colors.alert
					: variant === "secondary"
						? theme.colors.ink
						: theme.colors.ink2;

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{ disabled: blocked, busy: loading }}
			disabled={blocked}
			activeOpacity={0.72}
			style={[
				styles.base,
				variant === "primary" && styles.primary,
				variant === "secondary" && styles.secondary,
				variant === "danger" && styles.danger,
				dangerTone && variant === "secondary" && styles.dangerOutline,
				blocked && styles.disabled,
				style,
			]}
			{...props}
		>
			{loading ? (
				<LoadingIndicator color={foreground} />
			) : (
				<AppText variant="label" style={[styles.label, { color: foreground }]}>
					{label}
				</AppText>
			)}
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create((theme) => ({
	base: {
		minHeight: theme.control.buttonMinHeight,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.md,
		paddingHorizontal: theme.spacing.lg,
		paddingVertical: theme.spacing.md,
	},
	primary: { backgroundColor: theme.colors.accent },
	secondary: {
		borderWidth: 1,
		borderColor: theme.colors.lineStrong,
		backgroundColor: "transparent",
	},
	danger: {
		borderWidth: 1,
		borderColor: theme.colors.alert,
		backgroundColor: "transparent",
	},
	dangerOutline: { borderColor: theme.colors.alert },
	disabled: { opacity: theme.opacity.disabled },
	label: { flexShrink: 1, textAlign: "center" },
}));
