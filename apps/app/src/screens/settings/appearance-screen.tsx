import type { AccentColor, ThemeMode } from "@bro/database-app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
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
		icon: "brightness-auto",
	},
	{
		value: "light",
		labelKey: "appearance.themeLight",
		detailKey: "appearance.themeLightDetail",
		icon: "light-mode",
	},
	{
		value: "dark",
		labelKey: "appearance.themeDark",
		detailKey: "appearance.themeDarkDetail",
		icon: "dark-mode",
	},
] as const satisfies readonly {
	value: ThemeMode;
	labelKey: string;
	detailKey: string;
	icon: keyof typeof MaterialIcons.glyphMap;
}[];

export function AppearanceScreen() {
	const { t } = useTranslation("settings");
	const { settings, updateAppearance } = useDeviceSettings();
	const { theme, rt } = useUnistyles();
	const activeScheme = rt.themeName === "dark" ? "dark" : "light";

	function chooseTheme(themeMode: ThemeMode) {
		updateAppearance(themeMode, settings.accentColor);
	}

	function chooseAccent(accentColor: AccentColor) {
		updateAppearance(settings.themeMode, accentColor);
	}

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("appearance.intro")}</AppText>

			<Card style={styles.card}>
				<SectionHeader title={t("appearance.themeTitle")} />
				<View accessibilityRole="radiogroup" style={styles.themeOptions}>
					{THEME_OPTIONS.map((option) => {
						const selected = option.value === settings.themeMode;
						return (
							<TouchableOpacity
								key={option.value}
								accessibilityRole="radio"
								accessibilityLabel={t("appearance.themeA11y", {
									name: t(option.labelKey),
								})}
								accessibilityState={{ selected }}
								activeOpacity={0.72}
								style={[styles.themeOption, selected && styles.selectedOption]}
								onPress={() => chooseTheme(option.value)}
							>
								<View
									style={[styles.themeIcon, selected && styles.selectedIcon]}
								>
									<MaterialIcons
										name={option.icon}
										size={22}
										color={
											selected ? theme.colors.brand : theme.colors.textMuted
										}
									/>
								</View>
								<View style={styles.themeCopy}>
									<AppText variant="label" style={styles.optionLabel}>
										{t(option.labelKey)}
									</AppText>
									<AppText variant="caption" color="muted">
										{t(option.detailKey)}
									</AppText>
								</View>
								<MaterialIcons
									name={selected ? "check-circle" : "radio-button-unchecked"}
									size={22}
									color={selected ? theme.colors.brand : theme.colors.border}
								/>
							</TouchableOpacity>
						);
					})}
				</View>
			</Card>

			<Card style={styles.card}>
				<SectionHeader title={t("appearance.accentTitle")} />
				<AppText color="muted">{t("appearance.accentIntro")}</AppText>
				<View accessibilityRole="radiogroup" style={styles.accents}>
					{ACCENT_OPTIONS.map((option) => {
						const selected = option.value === settings.accentColor;
						const preview = createTheme(activeScheme, option.value).colors;
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
								onPress={() => chooseAccent(option.value)}
							>
								<View
									style={[styles.swatch, { backgroundColor: preview.brand }]}
								>
									{selected ? (
										<MaterialIcons
											name="check"
											size={24}
											color={preview.onBrand}
										/>
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
	themeOption: {
		minHeight: theme.control.buttonMinHeight,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
		padding: theme.spacing.md,
		borderRadius: theme.radius.sm,
		borderWidth: 1,
		borderColor: theme.colors.border,
	},
	selectedOption: {
		borderColor: theme.colors.brand,
		backgroundColor: theme.colors.selected,
	},
	themeIcon: {
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.background,
	},
	selectedIcon: { backgroundColor: theme.colors.surface },
	themeCopy: { flex: 1 },
	optionLabel: { fontWeight: "600" },
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
		borderRadius: theme.radius.md,
	},
	selectedAccent: { borderWidth: 1 },
	swatch: {
		width: 52,
		height: 52,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.pill,
	},
	accentLabel: { fontWeight: "600", textAlign: "center" },
}));
