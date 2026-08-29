import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function ChallengesLayout() {
	const { theme } = useUnistyles();
	const { t } = useTranslation("navigation");
	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="[id]" options={{ title: t("challenges.detail") }} />
		</Stack>
	);
}
