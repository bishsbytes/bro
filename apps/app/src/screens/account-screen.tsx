import { useAuth } from "@bro/auth-app";
import { router } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "../theme/unistyles";
import { useDeviceSettings } from "../providers/device-settings-provider";

type Confirmation = "sign-out" | "delete-account" | null;

export function AccountScreen() {
	const {
		remoteIdentity,
		user,
		isPending,
		error,
		signOut,
		refreshRemoteIdentity,
		deleteAccount,
	} = useAuth();
	const { settings } = useDeviceSettings();
	const [confirmation, setConfirmation] = useState<Confirmation>(null);
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const resetAction = () => {
		setConfirmation(null);
		setPassword("");
		setActionError(null);
	};

	const onSignOut = async () => {
		setSubmitting(true);
		setActionError(null);

		try {
			const result = await signOut();
			resetAction();
			setNotice(
				result.remoteRevocationPending
					? "Signed out on this device. The server could not be reached."
					: "Signed out on this device.",
			);
		} catch (caught) {
			// Sign-out is local-first and reports revocation failure in its result,
			// so reaching here means the device-local clearing itself broke.
			setActionError(
				caught instanceof Error ? caught.message : "Could not sign out.",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const onDeleteAccount = async () => {
		setSubmitting(true);
		setActionError(null);

		try {
			await deleteAccount(password);
			resetAction();
			setNotice("Your account was deleted. Data on this device is still here.");
		} catch (caught) {
			setActionError(
				caught instanceof Error
					? caught.message
					: "Could not delete the account.",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const hasStoredSession = settings.hasStoredRemoteSession;
	const isRegistered = remoteIdentity.kind === "registered";
	const isChecking = hasStoredSession && !isRegistered && isPending;
	const isUnavailable = hasStoredSession && !isRegistered && error != null;
	const isResolving = hasStoredSession && !isRegistered && !error && !isPending;

	return (
		<SafeAreaView style={styles.safeArea} edges={["bottom"]}>
			<ScrollView
				contentContainerStyle={styles.container}
				keyboardShouldPersistTaps="handled"
			>
				{notice ? <Text style={styles.notice}>{notice}</Text> : null}

				{!hasStoredSession && confirmation === null ? (
					<View>
						<Text style={styles.stateTitle}>Using bro without an account</Text>
						<Text style={styles.detail}>
							Creating or signing into an account does not move or back up data
							on this device.
						</Text>
						<PrimaryButton
							label="Sign in"
							onPress={() =>
								router.push({
									pathname: "/sign-in",
									params: { returnTo: "account" },
								})
							}
						/>
						<SecondaryButton
							label="Create an account"
							onPress={() =>
								router.push({
									pathname: "/sign-up",
									params: { returnTo: "account" },
								})
							}
						/>
					</View>
				) : null}

				{(isChecking || isResolving) && confirmation === null ? (
					<View style={styles.centeredState}>
						<ActivityIndicator />
						<Text style={styles.detail}>Checking your account…</Text>
					</View>
				) : null}

				{isUnavailable && confirmation === null ? (
					<View>
						<Text style={styles.stateTitle}>
							Account temporarily unavailable
						</Text>
						<Text style={styles.detail}>
							Your account could not be refreshed. You can keep using your data
							on this device.
						</Text>
						<PrimaryButton
							label="Try again"
							onPress={() => void refreshRemoteIdentity()}
						/>
						<SecondaryButton
							label="Sign out"
							onPress={() => {
								setNotice(null);
								setConfirmation("sign-out");
							}}
						/>
					</View>
				) : null}

				{isRegistered && confirmation === null ? (
					<View>
						<Text style={styles.stateTitle}>{user?.name}</Text>
						<Text style={styles.detail}>{user?.email}</Text>
						<Text style={styles.localDataNote}>
							Your account does not own or back up data on this device.
						</Text>

						<SecondaryButton
							label="Sign out"
							onPress={() => {
								setNotice(null);
								setConfirmation("sign-out");
							}}
						/>

						<View style={styles.dangerSection}>
							<Text style={styles.dangerHeading}>Danger zone</Text>
							<TouchableOpacity
								style={styles.dangerButton}
								onPress={() => {
									setNotice(null);
									setConfirmation("delete-account");
								}}
							>
								<Text style={styles.dangerButtonText}>Delete account</Text>
							</TouchableOpacity>
						</View>
					</View>
				) : null}

				{confirmation === "sign-out" ? (
					<View style={styles.confirmation}>
						<Text style={styles.confirmationTitle}>
							Sign out on this device?
						</Text>
						<Text style={styles.detail}>
							Your data on this device will stay here and remain available. This
							does not delete your account.
						</Text>
						{actionError ? (
							<Text style={styles.error}>{actionError}</Text>
						) : null}
						<PrimaryButton
							label={submitting ? "Signing out…" : "Sign out"}
							onPress={() => void onSignOut()}
							disabled={submitting}
						/>
						<SecondaryButton
							label="Cancel"
							onPress={resetAction}
							disabled={submitting}
						/>
					</View>
				) : null}

				{confirmation === "delete-account" ? (
					<View style={styles.confirmation}>
						<Text style={styles.confirmationTitle}>Delete your account?</Text>
						<Text style={styles.detail}>
							This permanently deletes your account and everything we hold for
							it. Your data on this device will stay here.
						</Text>
						{actionError ? (
							<Text style={styles.error}>{actionError}</Text>
						) : null}
						<TextInput
							style={styles.input}
							placeholder="Current password"
							value={password}
							onChangeText={setPassword}
							autoCapitalize="none"
							autoComplete="current-password"
							secureTextEntry
							editable={!submitting}
						/>
						<TouchableOpacity
							style={[
								styles.dangerConfirmButton,
								(submitting || password.length === 0) && styles.disabled,
							]}
							onPress={() => void onDeleteAccount()}
							disabled={submitting || password.length === 0}
						>
							<Text style={styles.dangerConfirmText}>
								{submitting ? "Deleting account…" : "Delete account"}
							</Text>
						</TouchableOpacity>
						<SecondaryButton
							label="Cancel"
							onPress={resetAction}
							disabled={submitting}
						/>
					</View>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}

function PrimaryButton({
	label,
	onPress,
	disabled = false,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<TouchableOpacity
			style={[styles.primaryButton, disabled && styles.disabled]}
			onPress={onPress}
			disabled={disabled}
		>
			<Text style={styles.primaryButtonText}>{label}</Text>
		</TouchableOpacity>
	);
}

function SecondaryButton({
	label,
	onPress,
	disabled = false,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<TouchableOpacity
			style={[styles.secondaryButton, disabled && styles.disabled]}
			onPress={onPress}
			disabled={disabled}
		>
			<Text style={styles.secondaryButtonText}>{label}</Text>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create((theme) => ({
	safeArea: {
		flex: 1,
		backgroundColor: theme.colors.background,
	},
	container: {
		flexGrow: 1,
		paddingHorizontal: theme.spacing.xl,
		paddingVertical: theme.spacing.xxl,
		backgroundColor: theme.colors.background,
	},
	stateTitle: {
		fontSize: theme.typography.body.fontSize,
		fontWeight: "600",
		color: theme.colors.text,
		marginBottom: theme.spacing.sm,
	},
	detail: {
		fontSize: theme.typography.label.fontSize,
		color: theme.colors.textSubtle,
		lineHeight: theme.typography.label.lineHeight,
	},
	localDataNote: {
		fontSize: theme.typography.caption.fontSize,
		color: theme.colors.textMuted,
		lineHeight: theme.typography.caption.lineHeight,
		marginTop: theme.spacing.lg,
	},
	centeredState: {
		alignItems: "center",
		gap: theme.spacing.md,
		paddingVertical: theme.spacing.xl,
	},
	primaryButton: {
		backgroundColor: theme.colors.brand,
		borderRadius: theme.radius.sm,
		paddingVertical: theme.spacing.lg,
		alignItems: "center",
		marginTop: theme.spacing.xl,
	},
	primaryButtonText: {
		color: theme.colors.onBrand,
		fontSize: theme.typography.label.fontSize,
		fontWeight: "500",
	},
	secondaryButton: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
		paddingVertical: theme.spacing.lg,
		alignItems: "center",
		marginTop: theme.spacing.md,
	},
	secondaryButtonText: {
		color: theme.colors.brand,
		fontSize: theme.typography.label.fontSize,
		fontWeight: "500",
	},
	notice: {
		fontSize: theme.typography.caption.fontSize,
		color: theme.colors.textMuted,
		marginBottom: theme.spacing.lg,
	},
	dangerSection: {
		borderTopWidth: 1,
		borderTopColor: theme.colors.border,
		marginTop: theme.spacing.xxl,
		paddingTop: theme.spacing.xl,
	},
	dangerHeading: {
		fontSize: theme.typography.label.fontSize,
		fontWeight: "600",
		color: theme.colors.danger,
	},
	dangerButton: {
		borderWidth: 1,
		borderColor: theme.colors.danger,
		borderRadius: theme.radius.sm,
		paddingVertical: theme.spacing.lg,
		alignItems: "center",
		marginTop: theme.spacing.md,
	},
	dangerButtonText: {
		color: theme.colors.danger,
		fontSize: theme.typography.label.fontSize,
		fontWeight: "500",
	},
	confirmation: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		padding: theme.spacing.lg,
		marginTop: theme.spacing.xl,
	},
	confirmationTitle: {
		fontSize: theme.typography.body.fontSize,
		fontWeight: "600",
		color: theme.colors.text,
		marginBottom: theme.spacing.sm,
	},
	input: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.md,
		fontSize: theme.typography.label.fontSize,
		color: theme.colors.text,
		marginTop: theme.spacing.lg,
	},
	error: {
		color: theme.colors.danger,
		fontSize: theme.typography.caption.fontSize,
		marginTop: theme.spacing.md,
	},
	dangerConfirmButton: {
		backgroundColor: theme.colors.danger,
		borderRadius: theme.radius.sm,
		paddingVertical: theme.spacing.lg,
		alignItems: "center",
		marginTop: theme.spacing.md,
	},
	dangerConfirmText: {
		color: theme.colors.onDanger,
		fontSize: theme.typography.label.fontSize,
		fontWeight: "600",
	},
	disabled: {
		opacity: 0.6,
	},
}));
