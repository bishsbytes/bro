import { useAuth } from "@bro/auth-app";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { FormField } from "../../components/form-field";
import { ListRow } from "../../components/list-row";
import { LoadingIndicator } from "../../components/loading-indicator";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { useDeviceSettings } from "../../providers/device-settings-provider";
import { StyleSheet } from "../../theme/unistyles";

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
		<Screen
			scroll
			padded
			contentContainerStyle={styles.container}
			keyboardShouldPersistTaps="handled"
		>
			<ListRow
				title="Settings"
				detail="Reminders, health data, units, and local data."
				accessibilityLabel="Open settings"
				onPress={() => router.push("/settings")}
			/>

			{notice ? (
				<AppText variant="caption" color="muted" style={styles.notice}>
					{notice}
				</AppText>
			) : null}

			{!hasStoredSession && confirmation === null ? (
				<View>
					<AppText variant="body" style={styles.stateTitle}>
						Using bro without an account
					</AppText>
					<AppText variant="label" color="subtle">
						Creating or signing into an account does not move or back up data on
						this device.
					</AppText>
					<Button
						label="Sign in"
						style={styles.primaryAction}
						onPress={() =>
							router.push({
								pathname: "/sign-in",
								params: { returnTo: "account" },
							})
						}
					/>
					<Button
						label="Create an account"
						variant="secondary"
						style={styles.secondaryAction}
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
					<LoadingIndicator />
					<AppText variant="label" color="subtle">
						Checking your account…
					</AppText>
				</View>
			) : null}

			{isUnavailable && confirmation === null ? (
				<View>
					<AppText style={styles.stateTitle}>
						Account temporarily unavailable
					</AppText>
					<AppText variant="label" color="subtle">
						Your account could not be refreshed. You can keep using your data on
						this device.
					</AppText>
					<Button
						label="Try again"
						style={styles.primaryAction}
						onPress={() => void refreshRemoteIdentity()}
					/>
					<Button
						label="Sign out"
						variant="secondary"
						style={styles.secondaryAction}
						onPress={() => {
							setNotice(null);
							setConfirmation("sign-out");
						}}
					/>
				</View>
			) : null}

			{isRegistered && confirmation === null ? (
				<View>
					<AppText style={styles.stateTitle}>{user?.name}</AppText>
					<AppText variant="label" color="subtle">
						{user?.email}
					</AppText>
					<AppText variant="caption" color="muted" style={styles.localDataNote}>
						Your account does not own or back up data on this device.
					</AppText>

					<Button
						label="Sign out"
						variant="secondary"
						style={styles.secondaryAction}
						onPress={() => {
							setNotice(null);
							setConfirmation("sign-out");
						}}
					/>

					<View style={styles.dangerSection}>
						<SectionHeader title="Danger zone" tone="danger" />
						<Button
							label="Delete account"
							variant="secondary"
							tone="danger"
							style={styles.secondaryAction}
							onPress={() => {
								setNotice(null);
								setConfirmation("delete-account");
							}}
						/>
					</View>
				</View>
			) : null}

			{confirmation === "sign-out" ? (
				<Card style={styles.confirmation}>
					<AppText style={styles.confirmationTitle}>
						Sign out on this device?
					</AppText>
					<AppText variant="label" color="subtle">
						Your data on this device will stay here and remain available. This
						does not delete your account.
					</AppText>
					{actionError ? (
						<AppText variant="caption" color="danger">
							{actionError}
						</AppText>
					) : null}
					<Button
						label="Sign out"
						loading={submitting}
						style={styles.primaryAction}
						onPress={() => void onSignOut()}
					/>
					<Button
						label="Cancel"
						variant="secondary"
						style={styles.secondaryAction}
						onPress={resetAction}
						disabled={submitting}
					/>
				</Card>
			) : null}

			{confirmation === "delete-account" ? (
				<Card style={styles.confirmation}>
					<AppText style={styles.confirmationTitle}>
						Delete your account?
					</AppText>
					<AppText variant="label" color="subtle">
						This permanently deletes your account and everything we hold for it.
						Your data on this device will stay here.
					</AppText>
					{actionError ? (
						<AppText variant="caption" color="danger">
							{actionError}
						</AppText>
					) : null}
					<FormField
						label="Current password"
						showLabel={false}
						containerStyle={styles.passwordField}
						placeholder="Current password"
						value={password}
						onChangeText={setPassword}
						autoCapitalize="none"
						autoComplete="current-password"
						secureTextEntry
						editable={!submitting}
					/>
					<Button
						label="Delete account"
						variant="danger"
						loading={submitting}
						style={styles.secondaryAction}
						onPress={() => void onDeleteAccount()}
						disabled={submitting || password.length === 0}
					/>
					<Button
						label="Cancel"
						variant="secondary"
						style={styles.secondaryAction}
						onPress={resetAction}
						disabled={submitting}
					/>
				</Card>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: {
		paddingVertical: theme.spacing.xs,
	},
	stateTitle: {
		fontWeight: "600",
		marginBottom: theme.spacing.sm,
	},
	localDataNote: { marginTop: theme.spacing.lg },
	centeredState: {
		alignItems: "center",
		gap: theme.spacing.md,
		paddingVertical: theme.spacing.xl,
	},
	primaryAction: { marginTop: theme.spacing.xl },
	secondaryAction: { marginTop: theme.spacing.md },
	notice: { marginBottom: theme.spacing.lg },
	dangerSection: {
		borderTopWidth: 1,
		borderTopColor: theme.colors.border,
		marginTop: theme.spacing.xxl,
		paddingTop: theme.spacing.xl,
	},
	confirmation: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		marginTop: theme.spacing.xl,
		gap: theme.spacing.md,
	},
	confirmationTitle: {
		fontWeight: "600",
	},
	passwordField: { marginTop: theme.spacing.sm },
}));
