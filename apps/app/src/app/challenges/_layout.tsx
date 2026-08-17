import { Stack } from "expo-router";
import { useUnistyles } from "../../theme/unistyles";

export default function ChallengesLayout() {
	const { theme } = useUnistyles();
	return (
		<Stack
			screenOptions={{
				headerStyle: { backgroundColor: theme.colors.headerBackground },
				headerTintColor: theme.colors.text,
				contentStyle: { backgroundColor: theme.colors.background },
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="[id]" options={{ title: "Challenge" }} />
		</Stack>
	);
}
