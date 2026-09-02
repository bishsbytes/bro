import { useLocalSearchParams } from "expo-router";
import { NewNoteScreen } from "../../screens/notes/new-note-screen";

export default function NewNoteRoute() {
	const { localDay } = useLocalSearchParams<{
		localDay?: string | string[];
	}>();
	return (
		<NewNoteScreen
			initialLocalDay={Array.isArray(localDay) ? localDay[0] : localDay}
		/>
	);
}
