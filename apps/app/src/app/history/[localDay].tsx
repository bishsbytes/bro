import { useLocalSearchParams } from "expo-router";
import { HistoryDayScreen } from "../../screens/history/history-day-screen";

export default function HistoryDayRoute() {
	const { localDay } = useLocalSearchParams<{ localDay: string }>();
	return <HistoryDayScreen localDay={localDay} />;
}
