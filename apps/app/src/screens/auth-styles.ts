import { StyleSheet } from "react-native-unistyles";

/** Shared by the sign-in and sign-up screens. */
export const authStyles = StyleSheet.create((theme) => ({
	container: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: theme.spacing.xl,
		backgroundColor: theme.colors.background,
	},
	title: {
		fontSize: theme.typography.title.fontSize,
		fontWeight: theme.typography.title.fontWeight,
		color: theme.colors.text,
		marginBottom: theme.spacing.sm,
	},
	subtitle: {
		fontSize: theme.typography.label.fontSize,
		color: theme.colors.textSubtle,
		marginBottom: theme.spacing.xl + theme.spacing.sm,
	},
	input: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.md,
		fontSize: theme.typography.label.fontSize,
		color: theme.colors.text,
		marginBottom: theme.spacing.md,
	},
	button: {
		backgroundColor: theme.colors.brand,
		borderRadius: theme.radius.sm,
		paddingVertical: theme.spacing.lg,
		alignItems: "center",
		marginTop: theme.spacing.md,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		color: theme.colors.onBrand,
		fontSize: theme.typography.label.fontSize,
		fontWeight: "500",
	},
	link: {
		marginTop: theme.spacing.xl,
		alignItems: "center",
	},
	linkText: {
		color: theme.colors.brand,
		fontSize: 15,
	},
	error: {
		color: theme.colors.danger,
		fontSize: theme.typography.caption.fontSize,
		marginBottom: theme.spacing.md,
	},
}));
