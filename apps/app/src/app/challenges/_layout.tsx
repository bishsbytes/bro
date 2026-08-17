import { Stack } from "expo-router";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function ChallengesLayout() {
	const { theme } = useUnistyles();
	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="[id]" options={{ title: "Challenge" }} />
		</Stack>
	);
}
