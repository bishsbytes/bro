import type { WeekStartDay } from "@bro/domain";
import { type HabitTemplate, resolveHabit } from "@bro/domain/habit-catalogue";
import { orderedIsoWeekdays } from "@bro/logic";
import { type Href, router, useFocusEffect } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { LoadingIndicator } from "../../components/loading-indicator";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createHabitsStore,
	type HabitEditorDraft,
	type HabitSettingsItem,
	type HabitSettingsSnapshot,
	type HabitsStore,
} from "../../habits/habits-store";
import { StyleSheet } from "../../theme/unistyles";
import {
	createUnitSettingsStore,
	type UnitSettingsStore,
} from "../../units/unit-settings-store";

type HabitsScreenStore = Pick<
	HabitsStore,
	| "loadSettings"
	| "addTemplate"
	| "addCustom"
	| "updateHabit"
	| "removeHabit"
	| "moveHabit"
>;

function habitMeta(t: TFunction<"habits">, item: HabitSettingsItem): string {
	const kind =
		item.habit.kind === "metric"
			? t("list.kindAutomatic")
			: t("list.kindManual");
	return item.areaLabel ? t("list.meta", { kind, area: item.areaLabel }) : kind;
}

type Editor =
	| { kind: "template"; template: HabitTemplate }
	| { kind: "custom" }
	| { kind: "existing"; item: HabitSettingsItem };

export function HabitsScreen({
	store,
	unitSettingsStore,
	addTemplateSlug = null,
}: {
	store?: HabitsScreenStore;
	unitSettingsStore?: Pick<UnitSettingsStore, "loadWeekStart">;
	addTemplateSlug?: string | null;
}) {
	const { t } = useTranslation(["habits", "common"]);
	const habits = useMemo(() => store ?? createHabitsStore(), [store]);
	const unitSettings = useMemo(
		() => unitSettingsStore ?? createUnitSettingsStore(),
		[unitSettingsStore],
	);
	const [snapshot, setSnapshot] = useState<HabitSettingsSnapshot | null>(null);
	const [weekStart, setWeekStart] = useState<WeekStartDay>("monday");
	const weekdays = useMemo(() => orderedIsoWeekdays(weekStart), [weekStart]);
	const [editor, setEditor] = useState<Editor | null>(null);
	const consumedAddParam = useRef(false);
	const [label, setLabel] = useState("");
	const [daysOfWeek, setDaysOfWeek] = useState(0b111_1111);
	const [target, setTarget] = useState("");
	const [areaSlug, setAreaSlug] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const [nextSnapshot, nextWeekStart] = await Promise.all([
				habits.loadSettings(),
				unitSettings.loadWeekStart(),
			]);
			setSnapshot(nextSnapshot);
			setWeekStart(nextWeekStart);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [habits, unitSettings]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	// A push from the review flow can preselect a catalogue habit to add. The
	// param is consumed once, after the first load, and an already-active slug
	// is a no-op (addTemplate has no uniqueness guard).
	useEffect(() => {
		if (!addTemplateSlug || consumedAddParam.current || !snapshot) return;
		consumedAddParam.current = true;
		const template = resolveHabit(addTemplateSlug);
		if (!template) return;
		if (snapshot.active.some((item) => item.habit.slug === template.slug)) {
			return;
		}
		beginTemplate(template);
	});

	function beginTemplate(template: HabitTemplate) {
		setEditor({ kind: "template", template });
		setLabel(template.label);
		setDaysOfWeek(template.defaultDaysOfWeek);
		setTarget(
			template.defaultTargetValue === null
				? ""
				: String(template.defaultTargetValue),
		);
		setAreaSlug(template.areaSlug);
		setError(null);
	}

	function beginCustom() {
		setEditor({ kind: "custom" });
		setLabel("");
		setDaysOfWeek(0b111_1111);
		setTarget("");
		setAreaSlug(null);
		setError(null);
	}

	function beginExisting(item: HabitSettingsItem) {
		setEditor({ kind: "existing", item });
		setLabel(item.label);
		setDaysOfWeek(item.habit.daysOfWeek);
		setTarget(
			item.habit.targetValue === null ? "" : String(item.habit.targetValue),
		);
		setAreaSlug(item.areaSlug);
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
			setError(t("editor.needName"));
			return;
		}
		if (daysOfWeek === 0) {
			setError(t("editor.needDay"));
			return;
		}
		const metric =
			editor.kind === "template"
				? editor.template.kind === "metric"
				: editor.kind === "existing"
					? editor.item.habit.kind === "metric"
					: false;
		const direction =
			editor.kind === "template"
				? editor.template.direction
				: editor.kind === "existing"
					? editor.item.habit.direction
					: null;
		const targetValue = metric && target.trim() ? Number(target) : null;
		// A ceiling habit may target zero ("none at all"); a floor habit of zero
		// would complete on silence, so it stays invalid.
		if (
			metric &&
			(targetValue === null ||
				!Number.isFinite(targetValue) ||
				(direction === "at_most" ? targetValue < 0 : targetValue <= 0))
		) {
			setError(t("editor.needTarget"));
			return;
		}
		const draft: HabitEditorDraft = {
			label,
			daysOfWeek,
			targetValue,
			areaSlug,
		};
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
				<LoadingIndicator size="large" />
			</Screen>
		);
	}
	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("intro")}</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}

			{editor ? (
				<Card style={styles.editor}>
					<SectionHeader
						title={
							editor.kind === "existing"
								? t("editor.editTitle")
								: editor.kind === "custom"
									? t("editor.addCustomTitle")
									: t("editor.addTitle")
						}
					/>
					<FormField
						label={t("editor.nameField")}
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
							label={t("editor.targetField")}
							value={target}
							keyboardType="decimal-pad"
							editable={!busy}
							onChangeText={setTarget}
						/>
					) : null}
					{editor.kind === "custom" ||
					(editor.kind === "existing" &&
						editor.item.habit.slug.startsWith("habit:custom:")) ? (
						<View style={styles.areaPicker}>
							<AppText variant="label">{t("editor.areaField")}</AppText>
							<View style={styles.areaChips}>
								{snapshot.areas.map((area) => {
									const selected = areaSlug === area.slug;
									return (
										<TouchableOpacity
											key={area.slug}
											accessibilityRole="button"
											accessibilityLabel={t("editor.areaOption", {
												name: area.label,
											})}
											accessibilityState={{ selected }}
											style={[styles.areaChip, selected && styles.selected]}
											disabled={busy}
											onPress={() => setAreaSlug(selected ? null : area.slug)}
										>
											<AppText variant="caption">{area.label}</AppText>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>
					) : null}
					<AppText variant="label">{t("editor.scheduledDays")}</AppText>
					<View style={styles.weekdays}>
						{weekdays.map((day) => {
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
							label={t("editor.save")}
							loading={busy}
							style={styles.action}
							onPress={() => void saveEditor()}
						/>
						<Button
							label={t("editor.cancel")}
							variant="text"
							disabled={busy}
							style={styles.action}
							onPress={() => setEditor(null)}
						/>
					</View>
				</Card>
			) : null}

			<SectionHeader title={t("list.title")} />
			{snapshot.active.length === 0 ? (
				<AppText color="muted">{t("list.empty")}</AppText>
			) : null}
			{snapshot.active.map((item, index) => (
				<Card key={item.habit.id} style={styles.habitCard}>
					<View style={styles.heading}>
						<View style={styles.copy}>
							<AppText variant="section">{item.label}</AppText>
							<AppText variant="caption" color="subtle">
								{habitMeta(t, item)}
							</AppText>
						</View>
						<Button
							label={t("list.edit")}
							variant="text"
							disabled={busy}
							onPress={() => beginExisting(item)}
						/>
					</View>
					<View style={styles.actions}>
						<Button
							label={t("list.moveUp")}
							accessibilityLabel={t("list.moveUpA11y", { name: item.label })}
							variant="secondary"
							disabled={busy || index === 0}
							style={styles.action}
							onPress={() =>
								void mutate(() => habits.moveHabit(item.habit.id, -1))
							}
						/>
						<Button
							label={t("list.moveDown")}
							accessibilityLabel={t("list.moveDownA11y", { name: item.label })}
							variant="secondary"
							disabled={busy || index === snapshot.active.length - 1}
							style={styles.action}
							onPress={() =>
								void mutate(() => habits.moveHabit(item.habit.id, 1))
							}
						/>
					</View>
					<Button
						label={t("list.viewRecord")}
						variant="secondary"
						disabled={busy}
						onPress={() =>
							router.push(
								`/habits/${encodeURIComponent(item.habit.id)}` as Href,
							)
						}
					/>
					<Button
						label={t("list.remove")}
						variant="text"
						tone="danger"
						disabled={busy}
						onPress={() => void mutate(() => habits.removeHabit(item.habit.id))}
					/>
				</Card>
			))}

			<Button
				label={t("list.addCustom")}
				variant="secondary"
				disabled={busy || editor !== null}
				onPress={beginCustom}
			/>

			{snapshot.groups.map((group, index) => (
				<View key={group.areaSlug} style={styles.catalogueGroup}>
					{group.more && (index === 0 || !snapshot.groups[index - 1]?.more) ? (
						<SectionHeader title={t("catalogue.more")} />
					) : null}
					<AppText variant="section">{group.areaLabel}</AppText>
					{group.habits.map((template) => (
						<Card key={template.slug} style={styles.catalogueCard}>
							<View style={styles.copy}>
								<AppText variant="score">{template.label}</AppText>
								<AppText color="muted">{template.description}</AppText>
							</View>
							<Button
								label={t("catalogue.add")}
								accessibilityLabel={t("catalogue.addA11y", {
									name: template.label,
								})}
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
	areaPicker: { gap: theme.spacing.xs },
	areaChips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
	areaChip: {
		paddingHorizontal: theme.spacing.sm,
		paddingVertical: theme.spacing.xs,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
	},
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
