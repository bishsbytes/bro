import { Stack } from "expo-router";
import { useUnistyles } from "../../../theme/unistyles";

export default function HistoryLayout() {
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
			<Stack.Screen
				name="index"
				options={{ title: "History", headerShown: false }}
			/>
			<Stack.Screen
				name="[localDay]"
				options={({ route }) => {
					const { localDay } = (route.params ?? {}) as { localDay?: string };
					return { title: localDay ?? "Day" };
				}}
			/>
		</Stack>
	);
}
