import { Stack } from "expo-router";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function FoodLayout() {
	const { theme } = useUnistyles();
	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: "Food" }} />
			<Stack.Screen name="[localDay]" options={{ title: "Food record" }} />
		</Stack>
	);
}
