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
			? theme.colors.onBrand
			: variant === "danger"
				? theme.colors.onDanger
				: dangerTone
					? theme.colors.danger
					: variant === "secondary"
						? theme.colors.text
						: theme.colors.brand;

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
	primary: { backgroundColor: theme.colors.brand },
	secondary: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		backgroundColor: theme.colors.surface,
	},
	danger: { backgroundColor: theme.colors.danger },
	dangerOutline: { borderColor: theme.colors.danger },
	disabled: { opacity: theme.opacity.disabled },
	label: { fontWeight: "700" },
}));
