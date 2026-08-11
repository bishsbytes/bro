import { useAuth } from "@bro/auth-app";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/** Placeholder for the signed-in experience, pending the first real feature. */
export function HomeScreen() {
	const { user, signOut } = useAuth();
	const [error, setError] = useState<string | null>(null);
	const [signingOut, setSigningOut] = useState(false);

	const onSignOut = async () => {
		setError(null);
		setSigningOut(true);

		try {
			await signOut();
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Could not sign out.",
			);
		} finally {
			setSigningOut(false);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.greeting}>Hey {user?.name ?? "there"} 👋</Text>
			<Text style={styles.detail}>{user?.email}</Text>
			<Text style={styles.detail}>Local database ready</Text>
			{error ? <Text style={styles.error}>{error}</Text> : null}

			<TouchableOpacity
				style={[styles.button, signingOut && styles.buttonDisabled]}
				onPress={onSignOut}
				disabled={signingOut}
			>
				<Text style={styles.buttonText}>
					{signingOut ? "Signing out…" : "Sign out"}
				</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 24,
		backgroundColor: "#ffffff",
	},
	greeting: {
		fontSize: 28,
		fontWeight: "600",
		marginBottom: 8,
	},
	detail: {
		fontSize: 15,
		color: "#6b7280",
		marginBottom: 4,
	},
	button: {
		marginTop: 32,
		borderWidth: 1,
		borderColor: "#d1d5db",
		borderRadius: 8,
		paddingVertical: 12,
		paddingHorizontal: 24,
	},
	buttonText: {
		fontSize: 16,
		color: "#143055",
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	error: {
		color: "#b91c1c",
		fontSize: 14,
		marginTop: 12,
	},
});
