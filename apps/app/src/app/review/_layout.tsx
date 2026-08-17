import { Stack } from "expo-router";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function ReviewLayout() {
	const { theme } = useUnistyles();

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: "Review" }} />
			<Stack.Screen name="new" options={{ title: "Take stock" }} />
			<Stack.Screen name="[id]" options={{ title: "Your wheel" }} />
			<Stack.Screen name="goal" options={{ title: "Set a goal" }} />
			<Stack.Screen
				name="challenge/[slug]"
				options={{ title: "Starter challenge" }}
			/>
		</Stack>
	);
}
