import type { DayNote } from "@bro/database-app";
import { formatLocalDayLabel } from "@bro/logic";
import { type Href, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { EmptyState } from "../../components/empty-state";
import { NoteRow } from "../../components/note-row";
import { SectionHeader } from "../../components/section-header";
import { TextAction } from "../../components/text-action";
import { StyleSheet } from "../../theme/unistyles";

type JournalNotesSectionProps = {
	notes: readonly DayNote[];
	todayLocalDay: string;
	onAddNote: () => void;
	onOpenNotes: () => void;
};

export function JournalNotesSection({
	notes,
	todayLocalDay,
	onAddNote,
	onOpenNotes,
}: JournalNotesSectionProps) {
	const { t } = useTranslation("notes");

	return (
		<View style={styles.section}>
			<SectionHeader
				title={t("journal.title")}
				action={
					<TextAction label={t("actions.viewAll")} onPress={onOpenNotes} />
				}
			/>
			{notes.length === 0 ? (
				<EmptyState
					title={t("journal.emptyTitle")}
					body={t("journal.emptyBody")}
					actionLabel={t("actions.add")}
					onAction={onAddNote}
				/>
			) : null}
			{notes.length > 0 ? (
				<View>
					{notes.map((note, index) => {
						const dayLabel = formatLocalDayLabel(note.localDay, todayLocalDay);
						return (
							<NoteRow
								key={note.id}
								accessibilityLabel={t("actions.openA11y", {
									day: dayLabel,
									position: index + 1,
									count: notes.length,
								})}
								markdown={note.body}
								createdAt={note.createdAt}
								updatedAt={note.updatedAt}
								first={index === 0}
								onPress={() => router.push(`/notes/${note.id}` as Href)}
							/>
						);
					})}
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { marginBottom: theme.spacing.xl, gap: theme.spacing.md },
}));
