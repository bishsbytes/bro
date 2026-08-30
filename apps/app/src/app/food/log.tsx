import { useLocalSearchParams } from "expo-router";
import { FoodScreen } from "../../screens/food/food-screen";

export default function FoodLogRoute() {
	const { customId } = useLocalSearchParams<{
		customId?: string | string[];
	}>();
	return (
		<FoodScreen
			view="log"
			initialCustomId={typeof customId === "string" ? customId : undefined}
		/>
	);
}
