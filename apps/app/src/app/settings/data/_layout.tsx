import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { stackScreenOptions, useUnistyles } from "../../../theme/unistyles";

export default function DataSettingsLayout() {
	const { theme } = useUnistyles();
	const { t } = useTranslation("navigation");

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: t("settings.data") }} />
			<Stack.Screen name="privacy" options={{ title: t("settings.privacy") }} />
			<Stack.Screen
				name="licences"
				options={{ title: t("settings.licences") }}
			/>
			<Stack.Screen name="export" options={{ title: t("settings.export") }} />
			<Stack.Screen
				name="delete"
				options={{ title: t("settings.deleteLocalData") }}
			/>
		</Stack>
	);
}
