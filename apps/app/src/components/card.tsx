import type { ComponentProps } from "react";
import { View } from "react-native";
import { StyleSheet } from "../theme/unistyles";

type CardProps = ComponentProps<typeof View> & {
	variant?: "filled" | "outlined";
};

export function Card({ variant = "filled", style, ...props }: CardProps) {
	return (
		<View
			{...props}
			style={[styles.card, variant === "outlined" && styles.outlined, style]}
		/>
	);
}

const styles = StyleSheet.create((theme) => ({
	card: {
		padding: theme.spacing.lg,
		borderRadius: theme.radius.card,
		backgroundColor: theme.colors.surface1,
	},
	outlined: {
		backgroundColor: theme.colors.canvas,
		borderWidth: 1,
		borderColor: theme.colors.line,
	},
}));
