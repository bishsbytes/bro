import { type Href, Redirect } from "expo-router";

export default function LegacyPrivacyRoute() {
	return <Redirect href={"/settings/data/privacy" as Href} />;
}
