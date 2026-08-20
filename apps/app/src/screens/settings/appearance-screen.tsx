import type { AccentColor, ThemeMode } from "@bro/database-app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { useDeviceSettings } from "../../providers/device-settings-provider";
import {
	ACCENT_OPTIONS,
	createTheme,
	StyleSheet,
	useUnistyles,
} from "../../theme/unistyles";

const THEME_OPTIONS: readonly {
	value: ThemeMode;
	label: string;
	detail: string;
	icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
	{
		value: "system",
		label: "System",
		detail: "Match this device",
		icon: "brightness-auto",
	},
	{
		value: "light",
		label: "Light",
		detail: "Always use light mode",
		icon: "light-mode",
	},
	{
		value: "dark",
		label: "Dark",
		detail: "Always use dark mode",
		icon: "dark-mode",
	},
];

export function AppearanceScreen() {
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
			<AppText color="muted">
				Keep bro calm and monochrome, or add a little colour where it matters.
				Changes appear instantly and stay on this device.
			</AppText>

			<Card style={styles.card}>
				<SectionHeader title="Theme" />
				<View accessibilityRole="radiogroup" style={styles.themeOptions}>
					{THEME_OPTIONS.map((option) => {
						const selected = option.value === settings.themeMode;
						return (
							<TouchableOpacity
								key={option.value}
								accessibilityRole="radio"
								accessibilityLabel={`${option.label} theme`}
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
										{option.label}
									</AppText>
									<AppText variant="caption" color="muted">
										{option.detail}
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
				<SectionHeader title="Accent colour" />
				<AppText color="muted">
					Used for primary actions, selected days, charts, and active
					navigation.
				</AppText>
				<View accessibilityRole="radiogroup" style={styles.accents}>
					{ACCENT_OPTIONS.map((option) => {
						const selected = option.value === settings.accentColor;
						const preview = createTheme(activeScheme, option.value).colors;
						return (
							<TouchableOpacity
								key={option.value}
								accessibilityRole="radio"
								accessibilityLabel={`${option.label} accent`}
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
									{option.label}
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
