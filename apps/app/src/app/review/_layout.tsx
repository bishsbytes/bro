import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function ReviewLayout() {
	const { theme } = useUnistyles();
	const { t } = useTranslation("navigation");

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: t("review.index") }} />
			<Stack.Screen name="new" options={{ title: t("review.new") }} />
			<Stack.Screen name="[id]" options={{ title: t("review.result") }} />
			<Stack.Screen name="goal" options={{ title: t("review.goal") }} />
			<Stack.Screen
				name="challenge/[slug]"
				options={{ title: t("review.challenge") }}
			/>
		</Stack>
	);
}
