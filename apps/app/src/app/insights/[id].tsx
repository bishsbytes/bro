import { useLocalSearchParams } from "expo-router";
import { InsightDetailScreen } from "../../screens/insight-detail-screen";

export default function InsightDetailRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <InsightDetailScreen id={id} />;
}
