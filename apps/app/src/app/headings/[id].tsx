import { useLocalSearchParams } from "expo-router";
import { HeadingDetailScreen } from "../../screens/life/heading-detail-screen";

export default function HeadingDetailRoute() {
	const { id } = useLocalSearchParams<{ id?: string | string[] }>();
	return (
		<HeadingDetailScreen id={Array.isArray(id) ? (id[0] ?? "") : (id ?? "")} />
	);
}
