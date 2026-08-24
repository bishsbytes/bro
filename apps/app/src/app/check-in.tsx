import { useLocalSearchParams } from "expo-router";
import { CheckInScreen } from "../screens/check-in/check-in-screen";

function firstParam(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

export default function CheckInRoute() {
	const { mood, entry } = useLocalSearchParams<{
		mood?: string | string[];
		entry?: string | string[];
	}>();
	const moodScore = Number(firstParam(mood));

	return (
		<CheckInScreen
			initialMood={
				Number.isInteger(moodScore) && moodScore >= 1 && moodScore <= 5
					? moodScore
					: undefined
			}
			entryId={firstParam(entry)}
		/>
	);
}
