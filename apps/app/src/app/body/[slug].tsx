import { useLocalSearchParams } from "expo-router";
import { BodyMetricScreen } from "../../screens/body-metric-screen";

export default function BodyMetricRoute() {
	const params = useLocalSearchParams<{ slug?: string | string[] }>();
	const metricSlug = Array.isArray(params.slug)
		? (params.slug[0] ?? "")
		: (params.slug ?? "");
	return <BodyMetricScreen metricSlug={metricSlug} />;
}
