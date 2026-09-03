import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { TouchableOpacity } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { Icon } from "./icon";

type SettingsButtonProps = {
	onPress?: () => void;
};

export function SettingsButton({
	onPress = () => router.push("/settings"),
}: SettingsButtonProps) {
	const { t } = useTranslation("common");
	const { theme } = useUnistyles();

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={t("a11y.settings")}
			hitSlop={theme.spacing.sm}
			style={styles.button}
			onPress={onPress}
		>
			<Icon
				testID="settings-header-icon"
				name="settings"
				color={theme.colors.ink2}
				size={theme.control.avatarIconSize}
			/>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create((theme) => ({
	button: {
		width: theme.control.avatarSize,
		height: theme.control.avatarSize,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 0,
		borderRadius: theme.control.avatarSize / 2,
		backgroundColor: "transparent",
	},
}));
