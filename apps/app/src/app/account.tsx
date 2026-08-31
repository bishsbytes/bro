import { Redirect } from "expo-router";

/** Preserve old account deep links after Account moved into Settings. */
export default function LegacyAccountRoute() {
	return <Redirect href="/settings" />;
}
