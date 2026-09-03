import { localTimeOf } from "@bro/domain";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { DateField } from "../../components/date-field";
import { FormField } from "../../components/form-field";
import { ModalSheet } from "../../components/modal-sheet";
import { TimeField } from "../../components/time-field";
import type {
	IntakeEventEdit,
	PresentedIntakeEntry,
	PresentedIntakeEvent,
} from "../../intake/intake-store";
import { StyleSheet } from "../../theme/unistyles";
import { IntakeRow } from "./intake-rows";

type EventEditorProps = {
	presented: PresentedIntakeEvent;
	busy: boolean;
	onSave: (edit: IntakeEventEdit) => void;
	onDelete: () => void;
	onBack: (() => void) | null;
};

/**
 * Corrects one entry. Quantity is the only lever on the stored amounts, which
 * rescale rather than recompute, so a later catalogue change cannot rewrite
 * what was logged.
 */
function EventEditor({
	presented,
	busy,
	onSave,
	onDelete,
	onBack,
}: EventEditorProps) {
	const { t } = useTranslation("intake");
	const { event } = presented;
	const [name, setName] = useState(event.name);
	const [portionLabel, setPortionLabel] = useState(event.portionLabel ?? "");
	const [quantity, setQuantity] = useState(String(event.quantity));
	const [localDay, setLocalDay] = useState(event.localDay);
	const [time, setTime] = useState(localTimeOf(event.occurredAt));

	return (
		<View style={styles.sheet}>
			<View>
				<AppText variant="section">{t("event.editTitle")}</AppText>
				{presented.contributions ? (
					<AppText variant="caption" color="muted">
						{t("event.storedSnapshot", { value: presented.contributions })}
					</AppText>
				) : null}
			</View>
			<FormField label={t("event.name")} value={name} onChangeText={setName} />
			<FormField
				label={t("event.portion")}
				value={portionLabel}
				onChangeText={setPortionLabel}
			/>
			<FormField
				label={t("event.quantity")}
				value={quantity}
				onChangeText={setQuantity}
				keyboardType="decimal-pad"
			/>
			<View style={styles.row}>
				<DateField
					label={t("event.date")}
					value={localDay}
					onChangeDate={setLocalDay}
					containerStyle={styles.grow}
				/>
				<TimeField
					label={t("event.time")}
					value={time}
					onChangeTime={setTime}
					containerStyle={styles.grow}
				/>
			</View>
			<Button
				label={t("event.save")}
				loading={busy}
				onPress={() =>
					onSave({
						name,
						portionLabel: portionLabel.trim() || null,
						quantity: Number(quantity),
						localDay,
						time,
					})
				}
			/>
			<View style={styles.row}>
				{onBack ? (
					<Button
						label={t("entry.backToGroup")}
						variant="text"
						disabled={busy}
						style={styles.grow}
						onPress={onBack}
					/>
				) : null}
				<Button
					label={t("event.delete")}
					variant="text"
					tone="danger"
					disabled={busy}
					style={styles.grow}
					onPress={onDelete}
				/>
			</View>
		</View>
	);
}

type EntrySheetContentProps = {
	entry: PresentedIntakeEntry;
	busy: boolean;
	onSave: (id: string, edit: IntakeEventEdit) => void;
	onDelete: (id: string) => void;
};

function EntrySheetContent({
	entry,
	busy,
	onSave,
	onDelete,
}: EntrySheetContentProps) {
	const { t } = useTranslation("intake");
	const [selectedId, setSelectedId] = useState<string | null>(
		entry.events.length === 1 ? (entry.events[0]?.event.id ?? null) : null,
	);
	const selected = entry.events.find(
		(presented) => presented.event.id === selectedId,
	);

	if (selected) {
		return (
			<EventEditor
				key={`${selected.event.id}:${selected.event.updatedAt}`}
				presented={selected}
				busy={busy}
				onSave={(edit) => onSave(selected.event.id, edit)}
				onDelete={() => onDelete(selected.event.id)}
				onBack={entry.events.length > 1 ? () => setSelectedId(null) : null}
			/>
		);
	}

	// A grouped row is several entries; each is corrected on its own.
	return (
		<View style={styles.sheet}>
			<View>
				<AppText variant="section">{entry.name}</AppText>
				<AppText color="muted">
					{t("entry.groupIntro", { count: entry.events.length })}
				</AppText>
			</View>
			<View>
				{entry.events.map((presented, index) => (
					<IntakeRow
						key={presented.event.id}
						leading={localTimeOf(presented.event.occurredAt)}
						title={presented.detail}
						value={presented.contributions || null}
						chevron
						last={index === entry.events.length - 1}
						accessibilityLabel={t("entry.pickA11y", {
							time: localTimeOf(presented.event.occurredAt),
						})}
						onPress={() => setSelectedId(presented.event.id)}
					/>
				))}
			</View>
		</View>
	);
}

type IntakeEntrySheetProps = {
	entry: PresentedIntakeEntry | null;
	busy: boolean;
	onSave: (id: string, edit: IntakeEventEdit) => void;
	onDelete: (id: string) => void;
	onClose: () => void;
};

/** The edit surface behind a row on the day: one sheet, never a second screen. */
export function IntakeEntrySheet({
	entry,
	busy,
	onSave,
	onDelete,
	onClose,
}: IntakeEntrySheetProps) {
	const { t } = useTranslation("intake");
	return (
		<ModalSheet
			visible={entry !== null}
			onClose={onClose}
			closeAccessibilityLabel={t("event.dismissA11y")}
		>
			{entry ? (
				<EntrySheetContent
					key={entry.key}
					entry={entry}
					busy={busy}
					onSave={onSave}
					onDelete={onDelete}
				/>
			) : null}
		</ModalSheet>
	);
}

const styles = StyleSheet.create((theme) => ({
	sheet: { gap: theme.spacing.lg },
	row: { flexDirection: "row", gap: theme.spacing.md },
	grow: { flex: 1 },
}));
