import { StyleSheet } from "../../theme/unistyles";

/** Shared by the sign-in and sign-up screens. */
export const authStyles = StyleSheet.create((theme) => ({
	container: {
		gap: theme.spacing.md,
	},
	subtitle: { marginBottom: theme.spacing.lg },
	submit: { marginTop: theme.spacing.md },
	link: { marginTop: theme.spacing.sm },
}));
