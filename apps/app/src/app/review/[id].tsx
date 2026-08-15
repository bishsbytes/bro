import { useLocalSearchParams } from "expo-router";
import { ReviewResultScreen } from "../../screens/review-result-screen";

export default function ReviewResultRoute() {
	const { id } = useLocalSearchParams<{ id?: string | string[] }>();
	const assessmentId = Array.isArray(id) ? (id[0] ?? "") : (id ?? "");
	return <ReviewResultScreen assessmentId={assessmentId} />;
}
