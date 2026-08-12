import { StyleSheet } from "react-native-unistyles";

export const onboardingStyles = StyleSheet.create((theme) => ({
	container: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: theme.spacing.xxl,
		backgroundColor: theme.colors.background,
	},
	eyebrow: {
		fontSize: theme.typography.label.fontSize,
		fontWeight: "600",
		color: theme.colors.brand,
		marginBottom: theme.spacing.md,
	},
	title: {
		fontSize: theme.typography.display.fontSize,
		lineHeight: theme.typography.display.lineHeight,
		fontWeight: theme.typography.display.fontWeight,
		color: theme.colors.text,
		marginBottom: theme.spacing.lg,
	},
	body: {
		fontSize: theme.typography.body.fontSize,
		lineHeight: theme.typography.body.lineHeight,
		color: theme.colors.textMuted,
		marginBottom: theme.spacing.md,
	},
	primaryButton: {
		backgroundColor: theme.colors.brand,
		borderRadius: theme.radius.md,
		paddingVertical: theme.spacing.lg,
		alignItems: "center",
		marginTop: theme.spacing.xxl,
	},
	primaryButtonText: {
		color: theme.colors.onBrand,
		fontSize: theme.typography.label.fontSize,
		fontWeight: "600",
	},
	secondaryButton: {
		paddingVertical: theme.spacing.lg,
		alignItems: "center",
		marginTop: theme.spacing.sm,
	},
	secondaryButtonText: {
		color: theme.colors.brand,
		fontSize: theme.typography.label.fontSize,
		fontWeight: "500",
	},
}));
