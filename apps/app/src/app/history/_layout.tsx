import { isCalendarDay, localDayOf } from "@bro/domain";
import { formatLocalDayLabel } from "@bro/logic";
import { Stack } from "expo-router";
import { stackScreenOptions, useUnistyles } from "../../theme/unistyles";

export default function HistoryLayout() {
	const { theme } = useUnistyles();

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen name="index" options={{ title: "History" }} />
			<Stack.Screen
				name="[localDay]"
				options={({ route }) => {
					const { localDay } = (route.params ?? {}) as { localDay?: string };
					return {
						title:
							localDay && isCalendarDay(localDay)
								? formatLocalDayLabel(localDay, localDayOf(new Date()))
								: "Day",
					};
				}}
			/>
		</Stack>
	);
}
