import { Stack } from "expo-router";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function DrinksLayout() {
	const { theme } = useUnistyles();

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: "Drinks" }} />
			<Stack.Screen name="[localDay]" options={{ title: "Drink record" }} />
		</Stack>
	);
}
