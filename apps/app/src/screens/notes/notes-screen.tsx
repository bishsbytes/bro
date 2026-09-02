import type { DayNote } from "@bro/database-app";
import { localDayOf } from "@bro/domain";
import { formatLocalDayLabel } from "@bro/logic";
import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { createNotesStore, type NotesStore } from "../../notes/notes-store";
import { StyleSheet } from "../../theme/unistyles";

type NotesScreenProps = {
	store?: Pick<NotesStore, "listNotes">;
	now?: () => Date;
};

function groupNotesByDay(notes: readonly DayNote[]) {
	const groups = new Map<string, DayNote[]>();
	for (const note of notes) {
		const dayNotes = groups.get(note.localDay) ?? [];
		dayNotes.push(note);
		groups.set(note.localDay, dayNotes);
	}
	return [...groups.entries()].sort(([left], [right]) =>
		right.localeCompare(left),
	);
}

export function NotesScreen({
	store,
	now = () => new Date(),
}: NotesScreenProps) {
	const { t } = useTranslation(["notes", "common"]);
	const notes = useMemo(() => store ?? createNotesStore(), [store]);
	const todayLocalDay = localDayOf(now());
	const { data, error, loading, reload } = useFocusStoreLoad(
		useCallback(() => notes.listNotes(), [notes]),
	);

	if (loading) return <LoadingScreen />;

	return (
		<Screen scroll padded gap="lg">
			{error ? (
				<EmptyState
					title={t("loadFailed")}
					body={error}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			) : null}

			{data?.length === 0 ? (
				<EmptyState
					title={t("empty.title")}
					body={t("empty.body")}
					actionLabel={t("actions.add")}
					onAction={() => router.push("/notes/new")}
				/>
			) : null}

			{groupNotesByDay(data ?? []).map(([localDay, dayNotes]) => (
				<View key={localDay} style={styles.day}>
					<SectionHeader title={formatLocalDayLabel(localDay, todayLocalDay)} />
					{dayNotes.map((note) => (
						<Card key={note.id}>
							<AppText variant="lead">{note.body}</AppText>
						</Card>
					))}
				</View>
			))}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	day: { gap: theme.spacing.md },
}));
