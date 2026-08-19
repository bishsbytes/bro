import { useLocalSearchParams } from "expo-router";
import { FoodDayScreen } from "../../screens/food/food-day-screen";

export default function FoodDayRoute() {
	const { localDay } = useLocalSearchParams<{ localDay?: string | string[] }>();
	return (
		<FoodDayScreen
			localDay={
				Array.isArray(localDay) ? (localDay[0] ?? "") : (localDay ?? "")
			}
		/>
	);
}
