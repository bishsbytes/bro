import { useLocalSearchParams } from "expo-router";
import { ChallengeDetailScreen } from "../../screens/challenge-detail-screen";

export default function ChallengeDetailRoute() {
	const { id } = useLocalSearchParams<{ id?: string | string[] }>();
	const enrolmentId = Array.isArray(id) ? (id[0] ?? "") : (id ?? "");
	return <ChallengeDetailScreen enrolmentId={enrolmentId} />;
}
