import {
	isCheckInSlot,
	suggestedCheckInSlot,
} from "@bro/domain/metric-registry";
import { useLocalSearchParams } from "expo-router";
import { CheckInScreen } from "../screens/check-in/check-in-screen";

function firstParam(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

export default function CheckInRoute() {
	const { slot, mood, entry } = useLocalSearchParams<{
		slot?: string | string[];
		mood?: string | string[];
		entry?: string | string[];
	}>();
	const moodScore = Number(firstParam(mood));
	const requested = firstParam(slot);

	return (
		<CheckInScreen
			// Today always names the sitting; the clock only covers a link that
			// does not, so the flow never opens without one.
			slot={
				isCheckInSlot(requested) ? requested : suggestedCheckInSlot(new Date())
			}
			initialMood={
				Number.isInteger(moodScore) && moodScore >= 1 && moodScore <= 5
					? moodScore
					: undefined
			}
			entryId={firstParam(entry)}
		/>
	);
}
