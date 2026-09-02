import { localDayOf } from "@bro/domain";
import { formatLocalDayLabel } from "@bro/logic";
import { router, Stack, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { EmptyState } from "../../components/empty-state";
import { MarkdownField } from "../../components/markdown-field";
import { MarkdownText } from "../../components/markdown-text";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { toMessage } from "../../lib/errors";
import { useStoreLoad } from "../../lib/use-store-load";
import { createNotesStore, type NotesStore } from "../../notes/notes-store";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

type EditNoteScreenProps = {
	noteId: string;
	store?: Pick<NotesStore, "loadNote" | "updateNote" | "deleteNote">;
	now?: () => Date;
	openUrl?: (url: string) => Promise<unknown>;
};

type NoteDraft = {
	noteId: string;
	body: string;
};

/**
 * One saved note, opened full screen.
 *
 * It opens as the note reads rather than with the keyboard up: most visits are
 * to re-read something, and an explicit action moves into editing when needed.
 */
export function EditNoteScreen({
	noteId,
	store,
	now = () => new Date(),
	openUrl = (url) => Linking.openURL(url),
}: EditNoteScreenProps) {
	const { t } = useTranslation("notes");
	const { theme } = useUnistyles();
	const navigation = useNavigation();
	const notes = useMemo(() => store ?? createNotesStore(), [store]);
	const {
		data: note,
		error: loadError,
		loading,
	} = useStoreLoad(useCallback(() => notes.loadNote(noteId), [notes, noteId]));
	// A draft names the note it belongs to. Expo Router can reuse this component
	// when a dynamic route parameter changes, and text from one note must never
	// become the draft for another.
	const [draft, setDraft] = useState<NoteDraft | null>(null);
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [confirmingDiscard, setConfirmingDiscard] = useState(false);
	const leaving = useRef(false);

	const draftBody =
		draft !== null && draft.noteId === note?.id ? draft.body : null;
	const edited = draftBody ?? note?.body ?? "";
	const empty = edited.trim().length === 0;
	const dirty =
		note !== null &&
		note !== undefined &&
		draftBody !== null &&
		draftBody !== note.body;

	useEffect(() => {
		leaving.current = false;
		setDraft(null);
		setEditing(false);
		setError(null);
		setConfirmingDelete(false);
		setConfirmingDiscard(false);
	}, [noteId]);

	async function openLink(url: string) {
		setError(null);
		try {
			await openUrl(url);
		} catch (caught) {
			setError(toMessage(caught));
		}
	}

	// The header, Android back button and iOS swipe all leave through the
	// navigator. Once words have changed, make that loss deliberate.
	useEffect(() => {
		return navigation.addListener("beforeRemove", (event) => {
			if (leaving.current || !dirty) return;
			event.preventDefault();
			setConfirmingDelete(false);
			setConfirmingDiscard(true);
		});
	}, [navigation, dirty]);

	function discardChanges() {
		leaving.current = true;
		router.back();
	}

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
			leaving.current = true;
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
			leaving.current = true;
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
				<EmptyState title={t("edit.loadFailed")} body={loadError} />
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
				{editing ? (
					<MarkdownField
						key={note.id}
						label={t("edit.field")}
						showLabel={false}
						defaultValue={note.body}
						onChangeMarkdown={(body) => setDraft({ noteId: note.id, body })}
						placeholder={t("edit.prompt")}
						autoFocus
						appearance="flush"
						containerStyle={styles.composer}
					/>
				) : (
					<ScrollView
						style={styles.composer}
						contentContainerStyle={styles.reader}
					>
						<MarkdownText
							markdown={note.body}
							onLinkPress={(url) => void openLink(url)}
						/>
					</ScrollView>
				)}

				{error ? (
					<AppText color="muted" style={styles.error}>
						{error}
					</AppText>
				) : null}

				{confirmingDiscard ? (
					<View style={styles.footer}>
						<AppText color="muted">{t("edit.discardPrompt")}</AppText>
						<View style={styles.actions}>
							<Button
								label={t("edit.keepEditing")}
								variant="secondary"
								style={styles.action}
								onPress={() => setConfirmingDiscard(false)}
							/>
							<Button
								label={t("edit.discardChanges")}
								variant="danger"
								style={styles.action}
								onPress={discardChanges}
							/>
						</View>
					</View>
				) : confirmingDelete ? (
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
							label={t(editing ? "edit.save" : "edit.start")}
							loading={saving}
							disabled={editing && empty}
							style={styles.action}
							onPress={() => {
								if (editing) {
									void save();
								} else {
									setEditing(true);
								}
							}}
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
	reader: { paddingBottom: theme.spacing.lg },
	error: { marginTop: theme.spacing.xs },
	footer: { gap: theme.spacing.sm },
	actions: { flexDirection: "row", gap: theme.spacing.md },
	action: { flex: 1 },
}));
