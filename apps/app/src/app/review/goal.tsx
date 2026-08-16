import { useLocalSearchParams } from "expo-router";
import { GoalScreen } from "../../screens/goal-screen";

export default function GoalRoute() {
	const params = useLocalSearchParams<{
		assessmentId?: string | string[];
		metricSlug?: string | string[];
	}>();
	const assessmentId = Array.isArray(params.assessmentId)
		? (params.assessmentId[0] ?? "")
		: (params.assessmentId ?? "");
	const metricSlug = Array.isArray(params.metricSlug)
		? (params.metricSlug[0] ?? "")
		: (params.metricSlug ?? "");
	return <GoalScreen assessmentId={assessmentId} metricSlug={metricSlug} />;
}
