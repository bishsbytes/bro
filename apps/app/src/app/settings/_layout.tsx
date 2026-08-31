import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function SettingsLayout() {
	const { theme } = useUnistyles();
	const { t } = useTranslation("navigation");

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: t("settings.index") }} />
			<Stack.Screen
				name="reminders"
				options={{ title: t("settings.reminders") }}
			/>
			<Stack.Screen name="units" options={{ title: t("settings.units") }} />
			<Stack.Screen
				name="appearance"
				options={{ title: t("settings.appearance") }}
			/>
			<Stack.Screen
				name="check-ins"
				options={{ title: t("settings.checkIns") }}
			/>
			<Stack.Screen name="drinks" options={{ title: t("settings.drinks") }} />
			<Stack.Screen name="food" options={{ title: t("settings.food") }} />
			<Stack.Screen name="health" options={{ title: t("settings.health") }} />
			<Stack.Screen name="data" options={{ headerShown: false }} />
		</Stack>
	);
}
