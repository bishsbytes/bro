import { isCalendarDay, localDayOf } from "@bro/domain";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { DateField } from "../../components/date-field";
import { FormField } from "../../components/form-field";
import { StackScreen as Screen } from "../../components/screen";
import { toMessage } from "../../lib/errors";
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

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			<DateField
				label={t("new.day")}
				value={localDay}
				onChangeDate={setLocalDay}
				maximumDate={now()}
			/>

			<View style={styles.composer}>
				<AppText variant="section">{t("new.prompt")}</AppText>
				<FormField
					label={t("new.field")}
					value={body}
					onChangeText={setBody}
					placeholder={t("new.placeholder")}
					multiline
					autoFocus
				/>
			</View>

			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label={t("new.save")}
				loading={saving}
				disabled={empty}
				onPress={() => void save()}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	composer: { gap: theme.spacing.md },
}));
