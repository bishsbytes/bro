import type { DayNote } from "@bro/database-app";
import { localDayOf } from "@bro/domain";
import { formatLocalDayLabel } from "@bro/logic";
import { type Href, router } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "../../components/button";
import { EmptyState } from "../../components/empty-state";
import { NoteRow } from "../../components/note-row";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	createNotesStore,
	NOTE_DAY_PAGE,
	type NotesStore,
} from "../../notes/notes-store";
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
	// The window lives in a ref so widening it does not change the loader's
	// identity: `useFocusStoreLoad` treats a new loader as a new subject and
	// clears the screen, and showing older notes should extend the list in
	// place rather than blank it back to a spinner.
	const dayLimit = useRef(NOTE_DAY_PAGE);
	const { data, error, loading, reload } = useFocusStoreLoad(
		useCallback(() => notes.listNotes(dayLimit.current), [notes]),
	);

	function showOlder() {
		dayLimit.current += NOTE_DAY_PAGE;
		void reload();
	}

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

			{data?.notes.length === 0 ? (
				<EmptyState
					title={t("empty.title")}
					body={t("empty.body")}
					actionLabel={t("actions.add")}
					onAction={() => router.push("/notes/new")}
				/>
			) : null}

			{groupNotesByDay(data?.notes ?? []).map(([localDay, dayNotes]) => {
				const dayLabel = formatLocalDayLabel(localDay, todayLocalDay);
				return (
					<View key={localDay} style={styles.day}>
						<SectionHeader title={dayLabel} />
						<View>
							{dayNotes.map((note, index) => (
								<NoteRow
									key={note.id}
									accessibilityLabel={t("actions.openA11y", {
										day: dayLabel,
										position: index + 1,
										count: dayNotes.length,
									})}
									markdown={note.body}
									createdAt={note.createdAt}
									updatedAt={note.updatedAt}
									last={index === dayNotes.length - 1}
									onPress={() => router.push(`/notes/${note.id}` as Href)}
								/>
							))}
						</View>
					</View>
				);
			})}

			{data?.hasMore ? (
				<Button
					label={t("actions.showOlder")}
					variant="secondary"
					onPress={showOlder}
				/>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	day: { gap: theme.spacing.md },
}));
