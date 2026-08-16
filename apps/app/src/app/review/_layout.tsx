import { Stack } from "expo-router";
import { useUnistyles } from "../../theme/unistyles";

export default function ReviewLayout() {
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
