import { type Href, Redirect } from "expo-router";

export default function LegacyExportRoute() {
	return <Redirect href={"/settings/data/export" as Href} />;
}
