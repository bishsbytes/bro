import { localDayOf } from "@bro/domain";
import { formatLocalDayLabel } from "@bro/logic";
import { router, Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { EmptyState } from "../../components/empty-state";
import { MarkdownField } from "../../components/markdown-field";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { toMessage } from "../../lib/errors";
import { useStoreLoad } from "../../lib/use-store-load";
import { createNotesStore, type NotesStore } from "../../notes/notes-store";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

type EditNoteScreenProps = {
	noteId: string;
	store?: Pick<NotesStore, "loadNote" | "updateNote" | "deleteNote">;
	now?: () => Date;
};

/**
 * One saved note, opened full screen.
 *
 * It opens as the note reads rather than with the keyboard up: most visits are
 * to re-read something, and the field is there to be tapped when they are not.
 */
export function EditNoteScreen({
	noteId,
	store,
	now = () => new Date(),
}: EditNoteScreenProps) {
	const { t } = useTranslation("notes");
	const { theme } = useUnistyles();
	const notes = useMemo(() => store ?? createNotesStore(), [store]);
	const {
		data: note,
		error: loadError,
		loading,
	} = useStoreLoad(useCallback(() => notes.loadNote(noteId), [notes, noteId]));
	// Seeded on the first render that has the note, so a save carries the whole
	// body even when nothing was typed.
	const [body, setBody] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const edited = body ?? note?.body ?? "";
	const empty = edited.trim().length === 0;

	async function save() {
		if (!note || saving || empty) return;
		setSaving(true);
		setError(null);
		try {
			const saved = await notes.updateNote(note.id, edited);
			if (!saved) {
				// The store keeps nothing for a blank body. The button is disabled
				// until there is something to keep, so this is a race the editor lost
				// rather than a dead end to close the screen on.
				setError(t("edit.emptyBody"));
				setSaving(false);
				return;
			}
			router.back();
		} catch (caught) {
			setError(toMessage(caught));
			setSaving(false);
		}
	}

	async function remove() {
		if (!note || saving) return;
		setSaving(true);
		setError(null);
		try {
			await notes.deleteNote(note.id);
			router.back();
		} catch (caught) {
			setError(toMessage(caught));
			setSaving(false);
			setConfirmingDelete(false);
		}
	}

	if (loading) return <LoadingScreen />;

	if (loadError) {
		return (
			<Screen padded>
				<EmptyState
					title={t("edit.loadFailed")}
					body={loadError}
					tone="danger"
				/>
			</Screen>
		);
	}

	if (!note) {
		return (
			<Screen padded>
				<EmptyState title={t("edit.missing")} body={t("edit.missingBody")} />
			</Screen>
		);
	}

	const dayLabel = formatLocalDayLabel(note.localDay, localDayOf(now()));

	return (
		<Screen padded>
			{/* The day a note belongs to is the one piece of context it carries, so
			    the header names it rather than repeating "Note". */}
			<Stack.Screen options={{ title: dayLabel }} />
			<KeyboardAvoidingView
				behavior="padding"
				automaticOffset
				keyboardVerticalOffset={theme.spacing.md}
				style={styles.fill}
			>
				<MarkdownField
					label={t("edit.field")}
					showLabel={false}
					defaultValue={note.body}
					onChangeMarkdown={setBody}
					placeholder={t("edit.prompt")}
					appearance="flush"
					containerStyle={styles.composer}
				/>

				{error ? (
					<AppText color="danger" style={styles.error}>
						{error}
					</AppText>
				) : null}

				{confirmingDelete ? (
					<View style={styles.footer}>
						<AppText color="muted">{t("edit.deletePrompt")}</AppText>
						<View style={styles.actions}>
							<Button
								label={t("edit.keepNote")}
								variant="secondary"
								style={styles.action}
								onPress={() => setConfirmingDelete(false)}
							/>
							<Button
								label={t("edit.delete")}
								variant="danger"
								loading={saving}
								style={styles.action}
								onPress={() => void remove()}
							/>
						</View>
					</View>
				) : (
					<View style={styles.actions}>
						<Button
							label={t("edit.delete")}
							variant="secondary"
							tone="danger"
							disabled={saving}
							style={styles.action}
							onPress={() => setConfirmingDelete(true)}
						/>
						<Button
							label={t("edit.save")}
							loading={saving}
							disabled={empty}
							style={styles.action}
							onPress={() => void save()}
						/>
					</View>
				)}
			</KeyboardAvoidingView>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	fill: { flex: 1, gap: theme.spacing.md },
	composer: { flex: 1 },
	error: { marginTop: theme.spacing.xs },
	footer: { gap: theme.spacing.sm },
	actions: { flexDirection: "row", gap: theme.spacing.md },
	action: { flex: 1 },
}));
