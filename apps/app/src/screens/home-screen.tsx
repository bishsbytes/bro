import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/** Placeholder local-first home pending the first product domain. */
export function HomeScreen() {
	return (
		<View style={styles.container}>
			<Text style={styles.greeting}>Hey there 👋</Text>
			<Text style={styles.detail}>Local database ready</Text>
			<TouchableOpacity
				style={styles.button}
				onPress={() => router.push("/account")}
			>
				<Text style={styles.buttonText}>Account</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: theme.spacing.xl,
		backgroundColor: theme.colors.background,
	},
	greeting: {
		fontSize: theme.typography.title.fontSize,
		fontWeight: theme.typography.title.fontWeight,
		color: theme.colors.text,
		marginBottom: theme.spacing.sm,
	},
	detail: {
		fontSize: theme.typography.label.fontSize,
		color: theme.colors.textSubtle,
		marginBottom: theme.spacing.xs,
	},
	button: {
		marginTop: theme.spacing.xl + theme.spacing.sm,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
		paddingVertical: theme.spacing.md,
		paddingHorizontal: theme.spacing.xl,
	},
	buttonText: {
		fontSize: theme.typography.label.fontSize,
		color: theme.colors.brand,
	},
}));
