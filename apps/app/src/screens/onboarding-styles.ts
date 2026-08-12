import { StyleSheet } from "react-native";

export const onboardingStyles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 28,
		backgroundColor: "#ffffff",
	},
	eyebrow: {
		fontSize: 16,
		fontWeight: "600",
		color: "#143055",
		marginBottom: 12,
	},
	title: {
		fontSize: 36,
		lineHeight: 42,
		fontWeight: "700",
		color: "#111827",
		marginBottom: 16,
	},
	body: {
		fontSize: 17,
		lineHeight: 26,
		color: "#4b5563",
		marginBottom: 12,
	},
	primaryButton: {
		backgroundColor: "#143055",
		borderRadius: 10,
		paddingVertical: 15,
		alignItems: "center",
		marginTop: 28,
	},
	primaryButtonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
	secondaryButton: {
		paddingVertical: 15,
		alignItems: "center",
		marginTop: 8,
	},
	secondaryButtonText: {
		color: "#143055",
		fontSize: 16,
		fontWeight: "500",
	},
});
