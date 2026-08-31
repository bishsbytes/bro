import { type Href, Redirect } from "expo-router";

export default function LegacyLicencesRoute() {
	return <Redirect href={"/settings/data/licences" as Href} />;
}
