import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { HeaderIconButton } from "./header-icon-button";

type SettingsButtonProps = {
	onPress?: () => void;
	surface?: boolean;
};

export function SettingsButton({
	onPress = () => router.push("/settings"),
	surface = false,
}: SettingsButtonProps) {
	const { t } = useTranslation("common");

	return (
		<HeaderIconButton
			icon="settings"
			testID="settings-header-icon"
			label={t("a11y.settings")}
			onPress={onPress}
			surface={surface}
		/>
	);
}
