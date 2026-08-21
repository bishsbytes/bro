import { Stack } from "expo-router";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function SettingsLayout() {
	const { theme } = useUnistyles();

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: "Settings" }} />
			<Stack.Screen name="reminders" options={{ title: "Reminders" }} />
			<Stack.Screen name="units" options={{ title: "Units & format" }} />
			<Stack.Screen name="appearance" options={{ title: "Appearance" }} />
			<Stack.Screen name="check-ins" options={{ title: "Check-ins" }} />
			<Stack.Screen name="drinks" options={{ title: "Drink settings" }} />
			<Stack.Screen name="food" options={{ title: "Food settings" }} />
			<Stack.Screen name="health" options={{ title: "Health data" }} />
			<Stack.Screen name="privacy" options={{ title: "Privacy" }} />
			<Stack.Screen name="licences" options={{ title: "Data licences" }} />
			<Stack.Screen name="export" options={{ title: "Export your data" }} />
		</Stack>
	);
}
