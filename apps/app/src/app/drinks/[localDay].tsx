import { useLocalSearchParams } from "expo-router";
import { DrinkDayScreen } from "../../screens/drinks/drink-day-screen";

export default function DrinkDayRoute() {
	const { localDay } = useLocalSearchParams<{ localDay?: string | string[] }>();
	return (
		<DrinkDayScreen
			localDay={Array.isArray(localDay) ? (localDay[0] ?? "") : (localDay ?? "")}
		/>
	);
}
