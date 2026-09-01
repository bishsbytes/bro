import { useLocalSearchParams } from "expo-router";
import { SubstanceDayScreen } from "../../screens/substances/substance-day-screen";
import { NICOTINE_DESCRIPTOR } from "../../substances/nicotine";

export default function NicotineDayRoute() {
	const { localDay } = useLocalSearchParams<{ localDay?: string | string[] }>();
	return (
		<SubstanceDayScreen
			descriptor={NICOTINE_DESCRIPTOR}
			localDay={
				Array.isArray(localDay) ? (localDay[0] ?? "") : (localDay ?? "")
			}
		/>
	);
}
