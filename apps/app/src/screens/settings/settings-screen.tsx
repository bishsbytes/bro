import type { AccentColor, ThemeMode } from "@bro/database-app";
import { deleteLocalProductData } from "@bro/database-app";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { ListRow } from "../../components/list-row";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import type { HealthGatewayAvailability } from "../../health/gateway";
import { healthImportEngine } from "../../health/import-service";
import { healthPlatformLabel } from "../../health/platform-label";
import { toMessage } from "../../lib/errors";
import { useDeviceSettings } from "../../providers/device-settings-provider";
import { cancelAllReminderNotifications } from "../../reminders/reminder-materialiser";
import { ACCENT_OPTIONS, StyleSheet } from "../../theme/unistyles";
import { AccountSection } from "./account-screen";

function themeSuffix(themeMode: ThemeMode): "System" | "Light" | "Dark" {
	return themeMode === "system"
		? "System"
		: themeMode === "light"
			? "Light"
			: "Dark";
}

function accentLabelKey(accentColor: AccentColor) {
	const option = ACCENT_OPTIONS.find(({ value }) => value === accentColor);
	return option?.labelKey ?? "appearance.accentNeutral";
}

type SettingsScreenProps = {
	deleteProductData?: () => Promise<void>;
	cancelReminderNotifications?: () => Promise<unknown>;
	healthAvailability?: () => Promise<HealthGatewayAvailability>;
};

type DeleteStep = "idle" | "confirm" | "complete";

const defaultHealthAvailability = () => healthImportEngine.availability();

function HealthSettingsEntry({
	availability = defaultHealthAvailability,
}: {
	availability?: () => Promise<HealthGatewayAvailability>;
}) {
	const { t } = useTranslation("settings");
	const [health, setHealth] = useState<HealthGatewayAvailability | null>(null);

	useEffect(() => {
		let active = true;
		void availability()
			.then((next) => {
				if (active) setHealth(next);
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [availability]);

	if (!health?.platform) return null;
	const platform = healthPlatformLabel(health.platform);
	return (
		<ListRow
			title={t("index.health")}
			detail={t("index.healthDetail", { platform })}
			accessibilityLabel={t("index.healthA11y")}
			onPress={() => router.push("/settings/health")}
		/>
	);
}

export function SettingsScreen({
	deleteProductData = deleteLocalProductData,
	cancelReminderNotifications = cancelAllReminderNotifications,
	healthAvailability = defaultHealthAvailability,
}: SettingsScreenProps) {
	const { t } = useTranslation("settings");
	const { settings } = useDeviceSettings();
	const [deleteStep, setDeleteStep] = useState<DeleteStep>("idle");
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function confirmDelete() {
		if (deleting) {
			return;
		}

		setDeleting(true);
		setError(null);
		try {
			await deleteProductData();
			await cancelReminderNotifications();
			setDeleteStep("complete");
		} catch (caught) {
			setError(toMessage(caught, t("localData.failed")));
		} finally {
			setDeleting(false);
		}
	}

	return (
		<Screen scroll padded gap="md" keyboardShouldPersistTaps="handled">
			<ListRow
				title={t("index.appearance")}
				detail={t("index.appearanceDetail")}
				value={t("index.appearanceValue", {
					theme: t(`appearance.theme${themeSuffix(settings.themeMode)}`),
					accent: t(accentLabelKey(settings.accentColor)),
				})}
				accessibilityLabel={t("index.appearanceA11y")}
				onPress={() => router.push("/settings/appearance" as Href)}
			/>
			<HealthSettingsEntry availability={healthAvailability} />
			<ListRow
				title={t("index.checkIns")}
				detail={t("index.checkInsDetail")}
				accessibilityLabel={t("index.checkInsA11y")}
				onPress={() => router.push("/settings/check-ins" as Href)}
			/>
			<ListRow
				title={t("index.drinks")}
				detail={t("index.drinksDetail")}
				accessibilityLabel={t("index.drinksA11y")}
				onPress={() => router.push("/settings/drinks" as Href)}
			/>
			<ListRow
				title={t("index.food")}
				detail={t("index.foodDetail")}
				accessibilityLabel={t("index.foodA11y")}
				onPress={() => router.push("/settings/food" as Href)}
			/>
			<ListRow
				title={t("index.units")}
				detail={t("index.unitsDetail")}
				accessibilityLabel={t("index.unitsA11y")}
				onPress={() => router.push("/settings/units")}
			/>
			<ListRow
				title={t("index.reminders")}
				detail={t("index.remindersDetail")}
				accessibilityLabel={t("index.remindersA11y")}
				onPress={() => router.push("/settings/reminders")}
			/>
			<ListRow
				title={t("index.privacy")}
				detail={t("index.privacyDetail")}
				accessibilityLabel={t("index.privacyA11y")}
				onPress={() => router.push("/settings/privacy" as Href)}
			/>
			<ListRow
				title={t("index.licences")}
				detail={t("index.licencesDetail")}
				accessibilityLabel={t("index.licencesA11y")}
				onPress={() => router.push("/settings/licences" as Href)}
			/>
			<ListRow
				title={t("index.export")}
				detail={t("index.exportDetail")}
				accessibilityLabel={t("index.exportA11y")}
				onPress={() => router.push("/settings/export" as Href)}
			/>
			<View style={styles.section}>
				<SectionHeader title={t("account.sectionTitle")} />
				<AccountSection />
			</View>
			<Card style={styles.section}>
				<SectionHeader title={t("localData.title")} />
				{deleteStep === "idle" ? (
					<>
						<AppText color="muted">{t("localData.intro")}</AppText>
						<Button
							label={t("localData.delete")}
							variant="secondary"
							tone="danger"
							onPress={() => {
								setError(null);
								setDeleteStep("confirm");
							}}
						/>
					</>
				) : null}

				{deleteStep === "confirm" ? (
					<View style={styles.confirmation}>
						<AppText variant="score" color="danger">
							{t("localData.confirmTitle")}
						</AppText>
						<AppText color="muted">{t("localData.confirmBody")}</AppText>
						{error ? <AppText color="danger">{error}</AppText> : null}
						<Button
							label={t("localData.confirmAction")}
							variant="danger"
							loading={deleting}
							onPress={() => void confirmDelete()}
						/>
						<Button
							label={t("localData.cancel")}
							variant="text"
							disabled={deleting}
							onPress={() => {
								setError(null);
								setDeleteStep("idle");
							}}
						/>
					</View>
				) : null}

				{deleteStep === "complete" ? (
					<View style={styles.confirmation}>
						<SectionHeader title={t("localData.doneTitle")} />
						<AppText color="muted">{t("localData.doneBody")}</AppText>
						<Button
							label={t("localData.backToToday")}
							onPress={() => router.replace("/")}
						/>
					</View>
				) : null}
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	confirmation: { gap: theme.spacing.md },
}));
