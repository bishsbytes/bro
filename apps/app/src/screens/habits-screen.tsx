import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { FormField } from "../components/form-field";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import type { HabitTemplate } from "../content/habit-catalogue";
import {
	createHabitsStore,
	type HabitEditorDraft,
	type HabitSettingsItem,
	type HabitSettingsSnapshot,
	type HabitsStore,
} from "../habits/habits-store";
import { ISO_WEEKDAYS } from "../reminders/day-bitmask";
import { StyleSheet } from "../theme/unistyles";

type HabitsScreenStore = Pick<
	HabitsStore,
	| "loadSettings"
	| "addTemplate"
	| "addCustom"
	| "updateHabit"
	| "removeHabit"
	| "moveHabit"
>;

type Editor =
	| { kind: "template"; template: HabitTemplate }
	| { kind: "custom" }
	| { kind: "existing"; item: HabitSettingsItem };

export function HabitsScreen({ store }: { store?: HabitsScreenStore }) {
	const habits = useMemo(() => store ?? createHabitsStore(), [store]);
	const [snapshot, setSnapshot] = useState<HabitSettingsSnapshot | null>(null);
	const [editor, setEditor] = useState<Editor | null>(null);
	const [label, setLabel] = useState("");
	const [daysOfWeek, setDaysOfWeek] = useState(0b111_1111);
	const [target, setTarget] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setSnapshot(await habits.loadSettings());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [habits]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	function beginTemplate(template: HabitTemplate) {
		setEditor({ kind: "template", template });
		setLabel(template.label);
		setDaysOfWeek(template.defaultDaysOfWeek);
		setTarget(
			template.defaultTargetValue === null
				? ""
				: String(template.defaultTargetValue),
		);
		setError(null);
	}

	function beginCustom() {
		setEditor({ kind: "custom" });
		setLabel("");
		setDaysOfWeek(0b111_1111);
		setTarget("");
		setError(null);
	}

	function beginExisting(item: HabitSettingsItem) {
		setEditor({ kind: "existing", item });
		setLabel(item.label);
		setDaysOfWeek(item.habit.daysOfWeek);
		setTarget(
			item.habit.targetValue === null ? "" : String(item.habit.targetValue),
		);
		setError(null);
	}

	function toggleWeekday(index: number) {
		setDaysOfWeek((current) => current ^ (1 << index));
	}

	async function mutate(work: () => Promise<unknown>, closeEditor = false) {
		setBusy(true);
		setError(null);
		try {
			await work();
			if (closeEditor) setEditor(null);
			await load();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	}

	async function saveEditor() {
		if (!editor) return;
		if (!label.trim()) {
			setError("Give this habit a name.");
			return;
		}
		if (daysOfWeek === 0) {
			setError("Choose at least one day.");
			return;
		}
		const metric =
			editor.kind === "template"
				? editor.template.kind === "metric"
				: editor.kind === "existing"
					? editor.item.habit.kind === "metric"
					: false;
		const targetValue = metric && target.trim() ? Number(target) : null;
		if (
			metric &&
			(targetValue === null ||
				!Number.isFinite(targetValue) ||
				targetValue <= 0)
		) {
			setError("Enter a valid target.");
			return;
		}
		const draft: HabitEditorDraft = { label, daysOfWeek, targetValue };
		await mutate(async () => {
			if (editor.kind === "template") {
				await habits.addTemplate(editor.template, draft);
			} else if (editor.kind === "custom") {
				await habits.addCustom(draft);
			} else {
				await habits.updateHabit(editor.item.habit, draft);
			}
		}, true);
	}

	if (!snapshot && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}
	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title="Habits could not be loaded"
					body={error ?? "Try again."}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg" edges={["bottom"]}>
			<AppText color="muted">
				Choose the days that matter. Unscheduled days never count against a
				streak.
			</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}

			{editor ? (
				<Card style={styles.editor}>
					<SectionHeader
						title={
							editor.kind === "existing"
								? "Edit habit"
								: editor.kind === "custom"
									? "Add your own"
									: "Add habit"
						}
					/>
					<FormField
						label="Habit name"
						value={label}
						editable={!busy}
						onChangeText={setLabel}
					/>
					{(
						editor.kind === "template"
							? editor.template.kind === "metric"
							: editor.kind === "existing" &&
								editor.item.habit.kind === "metric"
					) ? (
						<FormField
							label="Daily target"
							value={target}
							keyboardType="decimal-pad"
							editable={!busy}
							onChangeText={setTarget}
						/>
					) : null}
					<AppText variant="label">Scheduled days</AppText>
					<View style={styles.weekdays}>
						{ISO_WEEKDAYS.map((day) => {
							const selected = (daysOfWeek & (1 << day.index)) !== 0;
							return (
								<TouchableOpacity
									key={day.index}
									accessibilityRole="button"
									accessibilityLabel={day.label}
									accessibilityState={{ selected }}
									style={[styles.weekday, selected && styles.selected]}
									disabled={busy}
									onPress={() => toggleWeekday(day.index)}
								>
									<AppText variant="caption">{day.shortLabel}</AppText>
								</TouchableOpacity>
							);
						})}
					</View>
					<View style={styles.actions}>
						<Button
							label="Save habit"
							loading={busy}
							style={styles.action}
							onPress={() => void saveEditor()}
						/>
						<Button
							label="Cancel"
							variant="text"
							disabled={busy}
							style={styles.action}
							onPress={() => setEditor(null)}
						/>
					</View>
				</Card>
			) : null}

			<SectionHeader title="Your habits" />
			{snapshot.active.length === 0 ? (
				<AppText color="muted">No habits yet.</AppText>
			) : null}
			{snapshot.active.map((item, index) => (
				<Card key={item.habit.id} style={styles.habitCard}>
					<View style={styles.heading}>
						<View style={styles.copy}>
							<AppText variant="section">{item.label}</AppText>
							<AppText variant="caption" color="subtle">
								{item.habit.kind === "metric" ? "Automatic" : "Tap to complete"}
							</AppText>
						</View>
						<Button
							label="Edit"
							variant="text"
							disabled={busy}
							onPress={() => beginExisting(item)}
						/>
					</View>
					<View style={styles.actions}>
						<Button
							label="Move up"
							accessibilityLabel={`Move ${item.label} up`}
							variant="secondary"
							disabled={busy || index === 0}
							style={styles.action}
							onPress={() =>
								void mutate(() => habits.moveHabit(item.habit.id, -1))
							}
						/>
						<Button
							label="Move down"
							accessibilityLabel={`Move ${item.label} down`}
							variant="secondary"
							disabled={busy || index === snapshot.active.length - 1}
							style={styles.action}
							onPress={() =>
								void mutate(() => habits.moveHabit(item.habit.id, 1))
							}
						/>
					</View>
					<Button
						label="Remove habit"
						variant="text"
						tone="danger"
						disabled={busy}
						onPress={() => void mutate(() => habits.removeHabit(item.habit.id))}
					/>
				</Card>
			))}

			<Button
				label="Add your own"
				variant="secondary"
				disabled={busy || editor !== null}
				onPress={beginCustom}
			/>

			{snapshot.groups.map((group, index) => (
				<View key={group.areaSlug} style={styles.catalogueGroup}>
					{group.more && (index === 0 || !snapshot.groups[index - 1]?.more) ? (
						<SectionHeader title="More" />
					) : null}
					<AppText variant="section">{group.areaLabel}</AppText>
					{group.habits.map((template) => (
						<Card key={template.slug} style={styles.catalogueCard}>
							<View style={styles.copy}>
								<AppText variant="score">{template.label}</AppText>
								<AppText color="muted">{template.description}</AppText>
							</View>
							<Button
								label="Add"
								accessibilityLabel={`Add ${template.label}`}
								variant="secondary"
								disabled={busy || editor !== null}
								onPress={() => beginTemplate(template)}
							/>
						</Card>
					))}
				</View>
			))}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	editor: { gap: theme.spacing.md },
	habitCard: { gap: theme.spacing.md },
	heading: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
	copy: { flex: 1, gap: theme.spacing.xs },
	weekdays: { flexDirection: "row", gap: theme.spacing.xs },
	weekday: {
		flex: 1,
		minHeight: 42,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
	},
	selected: {
		backgroundColor: theme.colors.selected,
		borderColor: theme.colors.brand,
	},
	actions: { flexDirection: "row", gap: theme.spacing.sm },
	action: { flex: 1 },
	catalogueGroup: { gap: theme.spacing.md },
	catalogueCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
}));
