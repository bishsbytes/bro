import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function FoodLayout() {
	const { theme } = useUnistyles();
	const { t } = useTranslation("navigation");
	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: t("food.index") }} />
			<Stack.Screen name="[localDay]" options={{ title: t("food.day") }} />
		</Stack>
	);
}
