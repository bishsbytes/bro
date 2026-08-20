import { useLocalSearchParams } from "expo-router";
import { HabitDetailScreen } from "../../screens/habits/habit-detail-screen";

export default function HabitDetailRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <HabitDetailScreen id={id} />;
}
