import { useLocalSearchParams } from "expo-router";
import { EditNoteScreen } from "../../screens/notes/edit-note-screen";

export default function EditNoteRoute() {
	const { id } = useLocalSearchParams<{ id: string | string[] }>();
	return <EditNoteScreen noteId={Array.isArray(id) ? id[0] : id} />;
}
