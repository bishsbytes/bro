import type { ThemeMode } from "@bro/database-app";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ListRow } from "../../components/list-row";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import type { HealthGatewayAvailability } from "../../health/gateway";
import { healthImportEngine } from "../../health/import-service";
import { healthPlatformLabel } from "../../health/platform-label";
import { useDeviceSettings } from "../../providers/device-settings-provider";
import { matchingAccentOption, StyleSheet } from "../../theme/unistyles";
import { AccountSection } from "./account-screen";

function themeSuffix(themeMode: ThemeMode): "System" | "Light" | "Dark" {
	return themeMode === "system"
		? "System"
		: themeMode === "light"
			? "Light"
			: "Dark";
}

function accentLabelKey(hue: number, chroma: number) {
	const option = matchingAccentOption(hue, chroma);
	return option?.labelKey ?? "appearance.accentHarbour";
}

type SettingsScreenProps = {
	healthAvailability?: () => Promise<HealthGatewayAvailability>;
};

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
	healthAvailability = defaultHealthAvailability,
}: SettingsScreenProps) {
	const { t } = useTranslation("settings");
	const { settings } = useDeviceSettings();

	return (
		<Screen scroll padded gap="md" keyboardShouldPersistTaps="handled">
			<View style={styles.section}>
				<SectionHeader title={t("account.sectionTitle")} />
				<AccountSection />
			</View>
			<ListRow
				title={t("index.appearance")}
				detail={t("index.appearanceDetail")}
				value={t("index.appearanceValue", {
					theme: t(`appearance.theme${themeSuffix(settings.themeMode)}`),
					accent: t(accentLabelKey(settings.accentHue, settings.accentChroma)),
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
				title={t("index.data")}
				detail={t("index.dataDetail")}
				accessibilityLabel={t("index.dataA11y")}
				onPress={() => router.push("/settings/data" as Href)}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
}));
