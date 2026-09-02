import { isCalendarDay, localDayOf } from "@bro/domain";
import { formatLocalDayLabelShort } from "@bro/logic";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { DayPickerButton } from "../../components/day-picker-button";
import { MarkdownField } from "../../components/markdown-field";
import { StackScreen as Screen } from "../../components/screen";
import { toMessage } from "../../lib/errors";
import { useKeyboardInset } from "../../lib/use-keyboard-inset";
import { createNotesStore, type NotesStore } from "../../notes/notes-store";
import { StyleSheet } from "../../theme/unistyles";

type NewNoteScreenProps = {
	store?: Pick<NotesStore, "createNote">;
	initialLocalDay?: string;
	now?: () => Date;
};

export function NewNoteScreen({
	store,
	initialLocalDay,
	now = () => new Date(),
}: NewNoteScreenProps) {
	const { t } = useTranslation("notes");
	const notes = useMemo(() => store ?? createNotesStore(), [store]);
	const today = localDayOf(now());
	// Pinned for the life of the composer: a Date rebuilt every render would
	// hand the picker a new maximum on each keystroke.
	const latestDay = useMemo(() => now(), [now]);
	const [localDay, setLocalDay] = useState(
		initialLocalDay &&
			isCalendarDay(initialLocalDay) &&
			initialLocalDay <= today
			? initialLocalDay
			: today,
	);
	const [body, setBody] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirmingDiscard, setConfirmingDiscard] = useState(false);
	const keyboardInset = useKeyboardInset();
	const empty = body.trim().length === 0;

	async function save() {
		if (saving || empty) return;
		setSaving(true);
		setError(null);
		try {
			const saved = await notes.createNote(localDay, body);
			if (!saved) {
				// The store keeps nothing for a blank body. The button is disabled
				// until there is something to keep, so this is a race the composer
				// lost rather than a dead end to close the screen on.
				setError(t("new.emptyBody"));
				setSaving(false);
				return;
			}
			router.back();
		} catch (caught) {
			setError(toMessage(caught));
			setSaving(false);
		}
	}

	function discard() {
		// Nothing written yet is nothing to lose, so leaving needs no ceremony.
		// Once there are words on the screen, one tap must not take them away.
		if (empty) {
			router.back();
			return;
		}
		setConfirmingDiscard(true);
	}

	return (
		<Screen padded>
			<Stack.Screen
				options={{
					headerRight: () => (
						<DayPickerButton
							label={t("new.day")}
							value={localDay}
							displayValue={formatLocalDayLabelShort(localDay, today)}
							onChangeDate={setLocalDay}
							maximumDate={latestDay}
						/>
					),
				}}
			/>
			{/* The composer fills the screen and the formatting row and actions sit
			    under it, so the keyboard would cover them all without this. iOS
			    lifts them by the view below; Android, where edge-to-edge leaves the
			    window unresized, by the inset padding. */}
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={[styles.fill, { paddingBottom: keyboardInset }]}
			>
				<MarkdownField
					label={t("new.field")}
					showLabel={false}
					onChangeMarkdown={setBody}
					placeholder={t("new.prompt")}
					autoFocus
					// The whole screen is the note, so a box drawn around it would
					// only fence off the space it already owns.
					appearance="flush"
					containerStyle={styles.composer}
				/>

				{error ? (
					<AppText color="danger" style={styles.error}>
						{error}
					</AppText>
				) : null}

				{confirmingDiscard ? (
					<View style={styles.footer}>
						<AppText color="muted">{t("new.discardPrompt")}</AppText>
						<View style={styles.actions}>
							<Button
								label={t("new.keepWriting")}
								variant="secondary"
								style={styles.action}
								onPress={() => setConfirmingDiscard(false)}
							/>
							<Button
								label={t("new.discard")}
								variant="danger"
								style={styles.action}
								onPress={() => router.back()}
							/>
						</View>
					</View>
				) : (
					<View style={styles.actions}>
						<Button
							label={t("new.discard")}
							variant="secondary"
							tone="danger"
							disabled={saving}
							style={styles.action}
							onPress={discard}
						/>
						<Button
							label={t("new.save")}
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
