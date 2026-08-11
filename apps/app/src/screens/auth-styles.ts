import { StyleSheet } from "react-native";

/** Shared by the sign-in and sign-up screens. */
export const authStyles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 24,
		backgroundColor: "#ffffff",
	},
	title: {
		fontSize: 32,
		fontWeight: "600",
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 16,
		color: "#6b7280",
		marginBottom: 32,
	},
	input: {
		borderWidth: 1,
		borderColor: "#d1d5db",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 12,
		fontSize: 16,
		marginBottom: 12,
	},
	button: {
		backgroundColor: "#143055",
		borderRadius: 8,
		paddingVertical: 14,
		alignItems: "center",
		marginTop: 12,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "500",
	},
	link: {
		marginTop: 20,
		alignItems: "center",
	},
	linkText: {
		color: "#143055",
		fontSize: 15,
	},
	error: {
		color: "#b91c1c",
		fontSize: 14,
		marginBottom: 12,
	},
});
