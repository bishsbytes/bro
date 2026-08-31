import { useAuth } from "@bro/auth-app";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { FormField } from "../../components/form-field";
import { LoadingIndicator } from "../../components/loading-indicator";
import { SectionHeader } from "../../components/section-header";
import { toMessage } from "../../lib/errors";
import { useDeviceSettings } from "../../providers/device-settings-provider";
import { StyleSheet } from "../../theme/unistyles";

type Confirmation = "sign-out" | "delete-account" | null;

export function AccountSection() {
	const { t } = useTranslation(["settings", "common"]);
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
					? t("account.signedOutPending")
					: t("account.signedOut"),
			);
		} catch (caught) {
			// Sign-out is local-first and reports revocation failure in its result,
			// so reaching here means the device-local clearing itself broke.
			setActionError(toMessage(caught, t("account.signOutFailed")));
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
			setNotice(t("account.deleted"));
		} catch (caught) {
			setActionError(toMessage(caught, t("account.deleteFailed")));
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
		<View style={styles.container}>
			{notice ? (
				<AppText variant="caption" color="muted" style={styles.notice}>
					{notice}
				</AppText>
			) : null}

			{!hasStoredSession && confirmation === null ? (
				<View>
					<AppText variant="body" style={styles.stateTitle}>
						{t("account.anonymousTitle")}
					</AppText>
					<AppText variant="label" color="subtle">
						{t("account.anonymousBody")}
					</AppText>
					<Button
						label={t("account.signIn")}
						style={styles.primaryAction}
						onPress={() =>
							router.push({
								pathname: "/sign-in",
								params: { returnTo: "settings" },
							})
						}
					/>
					<Button
						label={t("account.createAccount")}
						variant="secondary"
						style={styles.secondaryAction}
						onPress={() =>
							router.push({
								pathname: "/sign-up",
								params: { returnTo: "settings" },
							})
						}
					/>
				</View>
			) : null}

			{(isChecking || isResolving) && confirmation === null ? (
				<View style={styles.centeredState}>
					<LoadingIndicator />
					<AppText variant="label" color="subtle">
						{t("account.checking")}
					</AppText>
				</View>
			) : null}

			{isUnavailable && confirmation === null ? (
				<View>
					<AppText style={styles.stateTitle}>
						{t("account.unavailableTitle")}
					</AppText>
					<AppText variant="label" color="subtle">
						{t("account.unavailableBody")}
					</AppText>
					<Button
						label={t("common:actions.tryAgain")}
						style={styles.primaryAction}
						onPress={() => void refreshRemoteIdentity()}
					/>
					<Button
						label={t("account.signOut")}
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
						{t("account.ownershipNote")}
					</AppText>

					<Button
						label={t("account.signOut")}
						variant="secondary"
						style={styles.secondaryAction}
						onPress={() => {
							setNotice(null);
							setConfirmation("sign-out");
						}}
					/>

					<View style={styles.dangerSection}>
						<SectionHeader title={t("account.dangerZone")} tone="danger" />
						<Button
							label={t("account.deleteAccount")}
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
						{t("account.signOutTitle")}
					</AppText>
					<AppText variant="label" color="subtle">
						{t("account.signOutBody")}
					</AppText>
					{actionError ? (
						<AppText variant="caption" color="danger">
							{actionError}
						</AppText>
					) : null}
					<Button
						label={t("account.signOut")}
						loading={submitting}
						style={styles.primaryAction}
						onPress={() => void onSignOut()}
					/>
					<Button
						label={t("account.cancel")}
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
						{t("account.deleteTitle")}
					</AppText>
					<AppText variant="label" color="subtle">
						{t("account.deleteBody")}
					</AppText>
					{actionError ? (
						<AppText variant="caption" color="danger">
							{actionError}
						</AppText>
					) : null}
					<FormField
						label={t("account.passwordField")}
						showLabel={false}
						containerStyle={styles.passwordField}
						placeholder={t("account.passwordField")}
						value={password}
						onChangeText={setPassword}
						autoCapitalize="none"
						autoComplete="current-password"
						secureTextEntry
						editable={!submitting}
					/>
					<Button
						label={t("account.deleteAccount")}
						variant="danger"
						loading={submitting}
						style={styles.secondaryAction}
						onPress={() => void onDeleteAccount()}
						disabled={submitting || password.length === 0}
					/>
					<Button
						label={t("account.cancel")}
						variant="secondary"
						style={styles.secondaryAction}
						onPress={resetAction}
						disabled={submitting}
					/>
				</Card>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: {
		paddingBottom: theme.spacing.xs,
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
