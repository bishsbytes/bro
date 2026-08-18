import { useLocalSearchParams } from "expo-router";
import { InsightDetailScreen } from "../../screens/insights/insight-detail-screen";

export default function InsightDetailRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <InsightDetailScreen id={id} />;
}
