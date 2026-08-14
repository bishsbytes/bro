import type { Reminder, ReminderSchedule } from "@bro/database-app";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Switch, View } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { FormField } from "../components/form-field";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import {
	EVERY_DAY_MASK,
	ISO_WEEKDAYS,
	type IsoWeekdayIndex,
	weekdaysFromMask,
} from "../reminders/day-bitmask";
import {
	createReminderStore,
	type ReminderScreenState,
	type ReminderStore,
} from "../reminders/reminder-store";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

type RemindersScreenProps = {
	store?: Pick<
		ReminderStore,
		"load" | "create" | "update" | "setEnabled" | "delete"
	>;
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

function formatDays(mask: number): string {
	if (mask === EVERY_DAY_MASK) {
		return "Every day";
	}
	return weekdaysFromMask(mask)
		.map((index) => ISO_WEEKDAYS[index].shortLabel)
		.join(", ");
}

function ReminderEditor({
	initial,
	busy,
	onCancel,
	onSave,
}: {
	initial: ReminderSchedule;
	busy: boolean;
	onCancel(): void;
	onSave(schedule: ReminderSchedule): Promise<void>;
}) {
	const [time, setTime] = useState(formatTime(initial.minuteOfDay));
	const [daysOfWeek, setDaysOfWeek] = useState(initial.daysOfWeek);
	const [error, setError] = useState<string | null>(null);

	function toggleDay(day: IsoWeekdayIndex) {
		setDaysOfWeek((mask) => mask ^ (1 << day));
	}

	async function save() {
		const minuteOfDay = parseTime(time);
		if (minuteOfDay === null) {
			setError("Enter a time from 00:00 through 23:59.");
			return;
		}
		if (daysOfWeek === 0) {
			setError("Choose at least one day.");
			return;
		}
		setError(null);
		await onSave({ minuteOfDay, daysOfWeek });
	}

	return (
		<Card style={styles.editor}>
			<SectionHeader title="Reminder schedule" />
			<FormField
				label="Time (24-hour)"
				value={time}
				onChangeText={setTime}
				placeholder="20:00"
				keyboardType="numbers-and-punctuation"
				autoCapitalize="none"
			/>
			<View style={styles.days}>
				{ISO_WEEKDAYS.map((day) => {
					const selected = (daysOfWeek & (1 << day.index)) !== 0;
					return (
						<Button
							key={day.index}
							label={day.shortLabel}
							accessibilityLabel={`${selected ? "Remove" : "Add"} ${day.label}`}
							accessibilityState={{ selected }}
							variant={selected ? "primary" : "secondary"}
							style={styles.dayButton}
							onPress={() => toggleDay(day.index)}
						/>
					);
				})}
			</View>
			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label="Save reminder"
				loading={busy}
				onPress={() => void save()}
			/>
			<Button
				label="Cancel"
				variant="text"
				disabled={busy}
				onPress={onCancel}
			/>
		</Card>
	);
}

export function RemindersScreen({ store }: RemindersScreenProps) {
	const remindersStore = useMemo(() => store ?? createReminderStore(), [store]);
	const { theme } = useUnistyles();
	const [state, setState] = useState<ReminderScreenState | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [editing, setEditing] = useState<Reminder | "new" | null>(null);

	const load = useCallback(async () => {
		try {
			setError(null);
			setState(await remindersStore.load());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [remindersStore]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	async function mutate(work: () => Promise<void>) {
		setBusy(true);
		setError(null);
		try {
			await work();
			setEditing(null);
			await load();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	}

	if (!state && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg" edges={["bottom"]}>
			{state?.permission === "denied" ? (
				<Card style={styles.banner}>
					<AppText variant="label" color="danger">
						Notifications are off
					</AppText>
					<AppText color="muted">
						Your schedules are saved, but reminders stay silent until you turn
						notifications on in system settings.
					</AppText>
					<Button
						label="Open system settings"
						variant="secondary"
						onPress={() => void Linking.openSettings()}
					/>
				</Card>
			) : null}

			{error ? (
				<EmptyState
					title="Reminders could not be updated"
					body={error}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			) : null}

			{state?.reminders.length === 0 && editing !== "new" ? (
				<EmptyState
					title="No reminders yet"
					body="Add a schedule for the days and time you want this phone to nudge you."
					actionLabel="Add reminder"
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
							<AppText color="muted">{formatDays(reminder.daysOfWeek)}</AppText>
						</View>
						<Switch
							accessibilityLabel={`${reminder.enabled ? "Disable" : "Enable"} ${formatTime(reminder.minuteOfDay)} reminder`}
							value={reminder.enabled}
							disabled={busy}
							trackColor={{
								false: theme.colors.border,
								true: theme.colors.brand,
							}}
							onValueChange={(enabled) =>
								void mutate(() =>
									remindersStore.setEnabled(reminder.id, enabled),
								)
							}
						/>
					</View>
					<View style={styles.actions}>
						<Button
							label="Edit"
							variant="secondary"
							disabled={busy}
							style={styles.actionButton}
							onPress={() => setEditing(reminder)}
						/>
						<Button
							label="Delete"
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
							? { minuteOfDay: 20 * 60, daysOfWeek: EVERY_DAY_MASK }
							: editing
					}
					busy={busy}
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
				<Button label="Add reminder" onPress={() => setEditing("new")} />
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
