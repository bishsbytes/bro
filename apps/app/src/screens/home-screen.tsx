import { useAuth } from "@bro/auth-app";
import { router } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

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
	secondaryButton: {
		marginTop: theme.spacing.md,
		paddingVertical: theme.spacing.md,
		paddingHorizontal: theme.spacing.xl,
	},
	buttonText: {
		fontSize: theme.typography.label.fontSize,
		color: theme.colors.brand,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	notice: {
		color: theme.colors.textMuted,
		fontSize: theme.typography.caption.fontSize,
		marginTop: theme.spacing.md,
		textAlign: "center",
	},
}));
