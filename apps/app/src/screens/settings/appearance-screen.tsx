import type { ThemeMode } from "@bro/database-app";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { Icon, type IconName } from "../../components/icon";
import { OptionRow } from "../../components/option-row";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { useDeviceSettings } from "../../providers/device-settings-provider";
import {
	ACCENT_OPTIONS,
	createTheme,
	StyleSheet,
	useUnistyles,
} from "../../theme/unistyles";

/** `labelKey` and `detailKey` are keys in the `settings` catalogue, not copy. */
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
	const { rt } = useUnistyles();
	const activeScheme = rt.themeName === "dark" ? "dark" : "light";

	function chooseTheme(themeMode: ThemeMode) {
		updateAppearance(themeMode, settings.accentHue, settings.accentChroma);
	}

	function chooseAccent(hue: number, chroma: number) {
		updateAppearance(settings.themeMode, hue, chroma);
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

			<Card style={styles.card}>
				<SectionHeader title={t("appearance.accentTitle")} />
				<AppText color="muted">{t("appearance.accentIntro")}</AppText>
				<View accessibilityRole="radiogroup" style={styles.accents}>
					{ACCENT_OPTIONS.map((option) => {
						const selected = option.hue === settings.accentHue;
						const preview = createTheme(
							activeScheme,
							option.hue,
							option.chroma,
						).colors;
						return (
							<TouchableOpacity
								key={option.value}
								accessibilityRole="radio"
								accessibilityLabel={t("appearance.accentA11y", {
									name: t(option.labelKey),
								})}
								accessibilityState={{ selected }}
								activeOpacity={0.72}
								style={[
									styles.accent,
									selected && styles.selectedOption,
									selected && styles.selectedAccent,
								]}
								onPress={() => chooseAccent(option.hue, option.chroma)}
							>
								<View
									style={[styles.swatch, { backgroundColor: preview.accent }]}
								>
									{selected ? (
										<Icon name="check" size={24} color={preview.onAccent} />
									) : null}
								</View>
								<AppText variant="caption" style={styles.accentLabel}>
									{t(option.labelKey)}
								</AppText>
							</TouchableOpacity>
						);
					})}
				</View>
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	card: { gap: theme.spacing.md },
	themeOptions: { gap: theme.spacing.sm },
	selectedOption: {
		borderColor: theme.colors.accent,
		backgroundColor: theme.colors.accentTint,
	},
	accents: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		gap: theme.spacing.sm,
	},
	accent: {
		width: "31%",
		alignItems: "center",
		gap: theme.spacing.sm,
		paddingHorizontal: theme.spacing.xs,
		paddingVertical: theme.spacing.md,
		borderRadius: theme.radius.lg,
	},
	selectedAccent: { borderWidth: 1 },
	swatch: {
		width: 52,
		height: 52,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.md,
	},
	accentLabel: { fontWeight: "600", textAlign: "center" },
}));
