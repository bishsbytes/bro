import { isCalendarDay } from "@bro/domain";
import { useLocalSearchParams } from "expo-router";
import { IntakeDayScreen } from "../../screens/intake/intake-day-screen";

export default function IntakeDayRoute() {
	const { localDay } = useLocalSearchParams<{ localDay: string }>();
	return (
		<IntakeDayScreen
			localDay={
				typeof localDay === "string" && isCalendarDay(localDay)
					? localDay
					: null
			}
		/>
	);
}
