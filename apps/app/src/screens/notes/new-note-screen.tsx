import { readNoteDraft, writeNoteDraft } from "@bro/database-app";
import { isCalendarDay, localDayOf } from "@bro/domain";
import { formatLocalDayLabelShort } from "@bro/logic";
import { router, Stack } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { DayPickerButton } from "../../components/day-picker-button";
import { MarkdownField } from "../../components/markdown-field";
import { StackScreen as Screen } from "../../components/screen";
import { toMessage } from "../../lib/errors";
import { createNotesStore, type NotesStore } from "../../notes/notes-store";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

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
	const { theme } = useUnistyles();
	const [leaving, setLeaving] = useState(false);
	const [restored] = useState(() => {
		try {
			const raw = readNoteDraft();
			if (!raw) return null;
			const value: unknown = JSON.parse(raw);
			if (
				typeof value !== "object" ||
				value === null ||
				!("body" in value) ||
				!("localDay" in value)
			)
				return null;
			return typeof value.body === "string" &&
				typeof value.localDay === "string" &&
				isCalendarDay(value.localDay)
				? { body: value.body, localDay: value.localDay }
				: null;
		} catch {
			return null;
		}
	});
	const notes = useMemo(() => store ?? createNotesStore(), [store]);
	const today = localDayOf(now());
	// Pinned for the life of the composer: a Date rebuilt every render would
	// hand the picker a new maximum on each keystroke.
	const latestDay = useMemo(() => now(), [now]);
	const [localDay, setLocalDay] = useState(
		restored?.localDay ??
			(initialLocalDay &&
			isCalendarDay(initialLocalDay) &&
			initialLocalDay <= today
				? initialLocalDay
				: today),
	);
	const [body, setBody] = useState(restored?.body ?? "");
	const [saving, setSaving] = useState(false);
	const savedDraft = useRef<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [confirmingDiscard, setConfirmingDiscard] = useState(false);
	const empty = body.trim().length === 0;

	usePreventRemove(!leaving && !empty, () => setConfirmingDiscard(true));
	useEffect(() => {
		if (leaving) router.back();
	}, [leaving]);

	function changeBody(next: string) {
		setBody(next);
		try {
			writeNoteDraft(
				next.trim() ? JSON.stringify({ localDay, body: next }) : null,
			);
			setError(null);
		} catch (caught) {
			setError(toMessage(caught));
		}
	}

	function changeDay(date: string) {
		setLocalDay(date);
		try {
			writeNoteDraft(
				body.trim() ? JSON.stringify({ localDay: date, body }) : null,
			);
		} catch (caught) {
			setError(toMessage(caught));
		}
	}

	function discardDraft() {
		try {
			writeNoteDraft(null);
		} catch (caught) {
			setError(toMessage(caught));
			return;
		}
		setLeaving(true);
	}

	async function save() {
		if (saving || empty) return;
		setSaving(true);
		setError(null);
		try {
			const fingerprint = JSON.stringify({ localDay, body });
			const saved =
				savedDraft.current === fingerprint ||
				(await notes.createNote(localDay, body));
			if (!saved) {
				// The store keeps nothing for a blank body. The button is disabled
				// until there is something to keep, so this is a race the composer
				// lost rather than a dead end to close the screen on.
				setError(t("new.emptyBody"));
				setSaving(false);
				return;
			}
			savedDraft.current = fingerprint;
			writeNoteDraft(null);
			setLeaving(true);
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
							onChangeDate={changeDay}
							maximumDate={latestDay}
						/>
					),
				}}
			/>
			{/* The composer fills the screen and the formatting row and actions sit
			    under it, so the keyboard would cover them all. This is the keyboard
			    controller's view rather than React Native's: the platform one does
			    nothing on Android, where edge-to-edge stops `adjustResize` from
			    resizing the window. `automaticOffset` measures where the composer
			    actually sits, which is what the stack header would otherwise throw
			    out. */}
			<KeyboardAvoidingView
				behavior="padding"
				automaticOffset
				// Alongside `automaticOffset` this is purely extra room, so the
				// actions rest a gap above the keyboard rather than on top of it.
				keyboardVerticalOffset={theme.spacing.md}
				style={styles.fill}
			>
				<MarkdownField
					label={t("new.field")}
					showLabel={false}
					defaultValue={restored?.body}
					onChangeMarkdown={changeBody}
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
								onPress={discardDraft}
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
