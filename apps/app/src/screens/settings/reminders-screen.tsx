import type { Reminder, ReminderSchedule } from "@bro/database-app";
import type { WeekStartDay } from "@bro/domain";
import { CHECK_IN_SLOTS, type CheckInSlot } from "@bro/domain/metric-registry";
import {
	EVERY_DAY_MASK,
	ISO_WEEKDAYS,
	type IsoWeekdayIndex,
	orderedIsoWeekdays,
	weekdaysFromMask,
} from "@bro/logic";
import type { TFunction } from "i18next";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { ThemedSwitch } from "../../components/themed-switch";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	createReminderStore,
	type ReminderStore,
} from "../../reminders/reminder-store";
import { StyleSheet } from "../../theme/unistyles";
import {
	createUnitSettingsStore,
	type UnitSettingsStore,
} from "../../units/unit-settings-store";

type RemindersScreenProps = {
	store?: Pick<
		ReminderStore,
		"load" | "create" | "update" | "setEnabled" | "delete"
	>;
	unitSettingsStore?: Pick<UnitSettingsStore, "loadWeekStart">;
};

function formatTime(minuteOfDay: number): string {
	return `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(
		minuteOfDay % 60,
	).padStart(2, "0")}`;
}

function parseTime(value: string): number | null {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
	return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function formatDays(t: TFunction<"settings">, mask: number): string {
	if (mask === EVERY_DAY_MASK) {
		return t("reminders.everyDay");
	}
	return weekdaysFromMask(mask)
		.map((index) => ISO_WEEKDAYS[index].shortLabel)
		.join(", ");
}

function ReminderEditor({
	initial,
	busy,
	weekStart,
	onCancel,
	onSave,
}: {
	initial: ReminderSchedule;
	busy: boolean;
	weekStart: WeekStartDay;
	onCancel(): void;
	onSave(schedule: ReminderSchedule): Promise<void>;
}) {
	const { t } = useTranslation(["settings", "checkIn"]);
	const [time, setTime] = useState(formatTime(initial.minuteOfDay));
	const [daysOfWeek, setDaysOfWeek] = useState(initial.daysOfWeek);
	const [slot, setSlot] = useState<CheckInSlot>(initial.slot);
	const [error, setError] = useState<string | null>(null);
	const weekdays = useMemo(() => orderedIsoWeekdays(weekStart), [weekStart]);

	function toggleDay(day: IsoWeekdayIndex) {
		setDaysOfWeek((mask) => mask ^ (1 << day));
	}

	async function save() {
		const minuteOfDay = parseTime(time);
		if (minuteOfDay === null) {
			setError(t("reminders.badTime"));
			return;
		}
		if (daysOfWeek === 0) {
			setError(t("reminders.needDay"));
			return;
		}
		setError(null);
		await onSave({ minuteOfDay, daysOfWeek, slot });
	}

	return (
		<Card style={styles.editor}>
			<SectionHeader title={t("reminders.editorTitle")} />
			<FormField
				label={t("reminders.timeField")}
				value={time}
				onChangeText={setTime}
				placeholder={t("reminders.timePlaceholder")}
				keyboardType="numbers-and-punctuation"
				autoCapitalize="none"
			/>
			<View style={styles.days}>
				{weekdays.map((day) => {
					const selected = (daysOfWeek & (1 << day.index)) !== 0;
					return (
						<Button
							key={day.index}
							label={day.shortLabel}
							accessibilityLabel={
								selected
									? t("reminders.removeDay", { day: day.label })
									: t("reminders.addDay", { day: day.label })
							}
							accessibilityState={{ selected }}
							variant={selected ? "primary" : "secondary"}
							style={styles.dayButton}
							onPress={() => toggleDay(day.index)}
						/>
					);
				})}
			</View>
			{/* Which sitting this nudges for, so finishing one does not silence
			    the other. */}
			<AppText variant="caption" color="subtle">
				{t("reminders.slotLabel")}
			</AppText>
			<View style={styles.days}>
				{CHECK_IN_SLOTS.map((candidate) => (
					<Button
						key={candidate}
						label={t(`checkIn:slots.${candidate}.name`)}
						accessibilityState={{ selected: candidate === slot }}
						variant={candidate === slot ? "primary" : "secondary"}
						style={styles.dayButton}
						onPress={() => setSlot(candidate)}
					/>
				))}
			</View>
			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label={t("reminders.save")}
				loading={busy}
				onPress={() => void save()}
			/>
			<Button
				label={t("reminders.cancel")}
				variant="text"
				disabled={busy}
				onPress={onCancel}
			/>
		</Card>
	);
}

export function RemindersScreen({
	store,
	unitSettingsStore,
}: RemindersScreenProps) {
	const { t } = useTranslation(["settings", "common", "checkIn"]);
	const remindersStore = useMemo(() => store ?? createReminderStore(), [store]);
	const unitSettings = useMemo(
		() => unitSettingsStore ?? createUnitSettingsStore(),
		[unitSettingsStore],
	);
	const [busy, setBusy] = useState(false);
	const [editing, setEditing] = useState<Reminder | "new" | null>(null);
	const { data, error, loading, reload, setError } = useFocusStoreLoad(
		useCallback(async () => {
			const [state, weekStart] = await Promise.all([
				remindersStore.load(),
				unitSettings.loadWeekStart(),
			]);
			return { state, weekStart };
		}, [remindersStore, unitSettings]),
	);
	const state = data?.state;
	const weekStart: WeekStartDay = data?.weekStart ?? "monday";

	async function mutate(work: () => Promise<void>) {
		setBusy(true);
		setError(null);
		try {
			await work();
			setEditing(null);
			await reload();
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	return (
		<Screen scroll padded gap="lg">
			{/* Anything short of granted leaves the schedules below silent, and
			    Android hands back "undetermined" for a prompt the user has
			    dismissed once. The warning waits for a schedule to warn about,
			    so a first visit to an empty screen stays quiet. */}
			{state && state.permission !== "granted" && state.reminders.length > 0 ? (
				<Card style={styles.banner}>
					<AppText variant="label" color="danger">
						{t("reminders.deniedTitle")}
					</AppText>
					<AppText color="muted">{t("reminders.deniedBody")}</AppText>
					<Button
						label={t("reminders.openSystemSettings")}
						variant="secondary"
						onPress={() => void Linking.openSettings()}
					/>
				</Card>
			) : null}

			{error ? (
				<EmptyState
					title={t("reminders.updateFailed")}
					body={error}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			) : null}

			{state?.reminders.length === 0 && editing !== "new" ? (
				<EmptyState
					title={t("reminders.emptyTitle")}
					body={t("reminders.emptyBody")}
					actionLabel={t("reminders.add")}
					onAction={() => setEditing("new")}
				/>
			) : null}

			{state?.reminders.map((reminder) => (
				<Card key={reminder.id} style={styles.reminder}>
					<View style={styles.reminderHeading}>
						<View style={styles.reminderCopy}>
							<AppText variant="score">
								{formatTime(reminder.minuteOfDay)}
							</AppText>
							<AppText color="muted">
								{formatDays(t, reminder.daysOfWeek)}
							</AppText>
							<AppText variant="caption" color="subtle">
								{t(`checkIn:slots.${reminder.slot}.name`)}
							</AppText>
						</View>
						<ThemedSwitch
							accessibilityLabel={
								reminder.enabled
									? t("reminders.disable", {
											time: formatTime(reminder.minuteOfDay),
										})
									: t("reminders.enable", {
											time: formatTime(reminder.minuteOfDay),
										})
							}
							value={reminder.enabled}
							disabled={busy}
							onValueChange={(enabled) =>
								void mutate(() =>
									remindersStore.setEnabled(reminder.id, enabled),
								)
							}
						/>
					</View>
					<View style={styles.actions}>
						<Button
							label={t("reminders.edit")}
							variant="secondary"
							disabled={busy}
							style={styles.actionButton}
							onPress={() => setEditing(reminder)}
						/>
						<Button
							label={t("reminders.delete")}
							variant="secondary"
							tone="danger"
							disabled={busy}
							style={styles.actionButton}
							onPress={() =>
								void mutate(() => remindersStore.delete(reminder.id))
							}
						/>
					</View>
				</Card>
			))}

			{editing ? (
				<ReminderEditor
					key={editing === "new" ? "new" : editing.id}
					initial={
						editing === "new"
							? {
									minuteOfDay: 20 * 60,
									daysOfWeek: EVERY_DAY_MASK,
									slot: "evening",
								}
							: editing
					}
					busy={busy}
					weekStart={weekStart}
					onCancel={() => setEditing(null)}
					onSave={(schedule) =>
						mutate(() =>
							editing === "new"
								? remindersStore.create(schedule).then(() => undefined)
								: remindersStore.update(editing.id, schedule),
						)
					}
				/>
			) : state && state.reminders.length > 0 ? (
				<Button label={t("reminders.add")} onPress={() => setEditing("new")} />
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	banner: { gap: theme.spacing.sm },
	reminder: { gap: theme.spacing.md },
	reminderHeading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	reminderCopy: { gap: theme.spacing.xs },
	actions: { flexDirection: "row", gap: theme.spacing.sm },
	actionButton: { flex: 1 },
	editor: { gap: theme.spacing.md },
	days: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	dayButton: { minWidth: 64, flexGrow: 1 },
}));
