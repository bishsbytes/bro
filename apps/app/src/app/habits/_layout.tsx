import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function HabitsLayout() {
	const { theme } = useUnistyles();
	const { t } = useTranslation("navigation");

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: t("habits.index") }} />
			<Stack.Screen name="[id]" options={{ title: t("habits.detail") }} />
		</Stack>
	);
}
