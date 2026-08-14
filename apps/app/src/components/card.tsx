import type { ComponentProps } from "react";
import { View } from "react-native";
import { StyleSheet } from "../theme/unistyles";

type CardProps = ComponentProps<typeof View>;

export function Card({ style, ...props }: CardProps) {
	return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create((theme) => ({
	card: {
		padding: theme.spacing.lg,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
}));
