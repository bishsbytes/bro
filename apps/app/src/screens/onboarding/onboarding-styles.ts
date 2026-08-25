import { StyleSheet } from "../../theme/unistyles";

export const onboardingStyles = StyleSheet.create((theme) => ({
	eyebrow: { marginBottom: theme.spacing.md, fontWeight: "600" },
	title: { marginBottom: theme.spacing.lg },
	body: { marginBottom: theme.spacing.md },
	primaryButton: { marginTop: theme.spacing.xxl },
	secondaryButton: { marginTop: theme.spacing.sm },
}));
