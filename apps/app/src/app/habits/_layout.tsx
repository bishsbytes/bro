import { Stack } from "expo-router";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function HabitsLayout() {
	const { theme } = useUnistyles();

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: "Habits" }} />
			<Stack.Screen name="[id]" options={{ title: "Habit record" }} />
		</Stack>
	);
}
