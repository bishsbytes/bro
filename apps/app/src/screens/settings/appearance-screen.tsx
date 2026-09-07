import type { ThemeMode } from "@bro/database-app";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import type { IconName } from "../../components/icon";
import { OptionRow } from "../../components/option-row";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { useDeviceSettings } from "../../providers/device-settings-provider";
import { StyleSheet } from "../../theme/unistyles";

/** Keys in the `settings` catalogue, not copy. */
const THEME_OPTIONS = [
	{
		value: "system",
		labelKey: "appearance.themeSystem",
		detailKey: "appearance.themeSystemDetail",
		icon: "theme-system",
	},
	{
		value: "light",
		labelKey: "appearance.themeLight",
		detailKey: "appearance.themeLightDetail",
		icon: "theme-light",
	},
	{
		value: "dark",
		labelKey: "appearance.themeDark",
		detailKey: "appearance.themeDarkDetail",
		icon: "theme-dark",
	},
] as const satisfies readonly {
	value: ThemeMode;
	labelKey: string;
	detailKey: string;
	icon: IconName;
}[];

export function AppearanceScreen() {
	const { t } = useTranslation("settings");
	const { settings, updateAppearance } = useDeviceSettings();

	function chooseTheme(themeMode: ThemeMode) {
		updateAppearance(themeMode, settings.accentHue, settings.accentChroma);
	}

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("appearance.intro")}</AppText>

			<Card style={styles.card}>
				<SectionHeader title={t("appearance.themeTitle")} />
				<View
					accessibilityRole="radiogroup"
					accessibilityLabel={t("appearance.themeTitle")}
					style={styles.themeOptions}
				>
					{THEME_OPTIONS.map((option) => (
						<OptionRow
							key={option.value}
							label={t(option.labelKey)}
							detail={t(option.detailKey)}
							icon={option.icon}
							selected={option.value === settings.themeMode}
							accessibilityLabel={t("appearance.themeA11y", {
								name: t(option.labelKey),
							})}
							onPress={() => chooseTheme(option.value)}
						/>
					))}
				</View>
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	card: { gap: theme.spacing.md },
	themeOptions: { gap: theme.spacing.sm },
}));
