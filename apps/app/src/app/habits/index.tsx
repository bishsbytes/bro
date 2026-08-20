import { useLocalSearchParams } from "expo-router";
import { HabitsScreen } from "../../screens/habits/habits-screen";

export default function HabitsRoute() {
	const { add } = useLocalSearchParams<{ add?: string }>();
	return (
		<HabitsScreen addTemplateSlug={typeof add === "string" ? add : null} />
	);
}
