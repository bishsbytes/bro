import { isTapeSiteSlug } from "@bro/domain/metric-registry";
import { useLocalSearchParams } from "expo-router";
import { MeasuringGuideScreen } from "../../screens/body/measuring-guide-screen";

export default function MeasuringGuideRoute() {
	const { site } = useLocalSearchParams<{ site?: string }>();
	const initialSite = site && isTapeSiteSlug(site) ? site : undefined;
	return <MeasuringGuideScreen initialSite={initialSite} />;
}
