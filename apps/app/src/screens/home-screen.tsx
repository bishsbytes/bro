import { useAuth } from "@bro/auth-app";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/** Placeholder local-first home pending the first product domain. */
export function HomeScreen() {
	const { remoteIdentity, user, signOut } = useAuth();
	const [notice, setNotice] = useState<string | null>(null);
	const [signingOut, setSigningOut] = useState(false);

	const onSignOut = async () => {
		setNotice(null);
		setSigningOut(true);

		try {
			const result = await signOut();
			setNotice(
				result.remoteRevocationPending
					? "Signed out on this device. The server could not be reached."
					: "Signed out on this device.",
			);
		} finally {
			setSigningOut(false);
		}
	};

	const isRegistered = remoteIdentity.kind === "registered";

	return (
		<View style={styles.container}>
			<Text style={styles.greeting}>Hey {user?.name ?? "there"} 👋</Text>
			<Text style={styles.detail}>Local database ready</Text>
			<Text style={styles.detail}>
				{isRegistered ? user?.email : "Using bro without an account"}
			</Text>
			{notice ? <Text style={styles.notice}>{notice}</Text> : null}

			{isRegistered ? (
				<TouchableOpacity
					style={[styles.button, signingOut && styles.buttonDisabled]}
					onPress={() => void onSignOut()}
					disabled={signingOut}
				>
					<Text style={styles.buttonText}>
						{signingOut ? "Signing out…" : "Sign out"}
					</Text>
				</TouchableOpacity>
			) : (
				<>
					<TouchableOpacity
						style={styles.button}
						onPress={() => router.push("/sign-in")}
					>
						<Text style={styles.buttonText}>Sign in</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.secondaryButton}
						onPress={() => router.push("/sign-up")}
					>
						<Text style={styles.buttonText}>Create an account</Text>
					</TouchableOpacity>
				</>
			)}
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
	secondaryButton: {
		marginTop: 12,
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
	notice: {
		color: "#4b5563",
		fontSize: 14,
		marginTop: 12,
		textAlign: "center",
	},
});
