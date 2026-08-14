import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export function ComingSoonScreen({ title }: { title: string }) {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>{title}</Text>
			<Text style={styles.detail}>Your check-ins will appear here soon.</Text>
			<TouchableOpacity style={styles.button} onPress={() => router.back()}>
				<Text style={styles.buttonText}>Back to today</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: theme.spacing.xl,
		backgroundColor: theme.colors.background,
	},
	title: {
		fontSize: theme.typography.title.fontSize,
		fontWeight: theme.typography.title.fontWeight,
		color: theme.colors.text,
	},
	detail: {
		fontSize: theme.typography.body.fontSize,
		color: theme.colors.textMuted,
		textAlign: "center",
		marginTop: theme.spacing.sm,
	},
	button: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		padding: theme.spacing.md,
		marginTop: theme.spacing.xl,
	},
	buttonText: {
		color: theme.colors.brand,
		fontSize: theme.typography.label.fontSize,
	},
}));
