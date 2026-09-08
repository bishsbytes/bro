import { localDayOf, resolveLocalMoment } from "@bro/domain";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { PracticeRow } from "../../components/practice-row";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { formatReadingDay } from "../../components/source-stamp";
import { TextAction } from "../../components/text-action";
import {
	type AreaPractice,
	createHabitsStore,
	type HabitsStore,
} from "../../habits/habits-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { formatReviewDate } from "../../review/review-presentation";
import {
	createReviewStore,
	type HeadingDetail,
	type ReviewStore,
} from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";
import { HeadingStatusBadge } from "./heading-card";
import { HeadingFormSheet, type HeadingFormValues } from "./heading-form-sheet";

type HeadingDetailStore = Pick<
	ReviewStore,
	"loadHeading" | "updateHeading" | "achieveGoal" | "abandonGoal"
>;

type HeadingDetailScreenProps = {
	id: string;
	store?: HeadingDetailStore;
	habitsStore?: Pick<HabitsStore, "loadAreaPractices" | "toggleManual">;
	now?: () => Date;
};

type Snapshot = {
	detail: HeadingDetail | null;
	practices: AreaPractice[];
};

/**
 * L03 Heading detail: what the heading is, what is being done about it, and
 * the two ways it ends. Archive and remove both keep the record and say so
 * before they are pressed.
 */
export function HeadingDetailScreen({
	id,
	store,
	habitsStore,
	now = () => new Date(),
}: HeadingDetailScreenProps) {
	const { t } = useTranslation(["life", "common"]);
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const habits = useMemo(
		() => habitsStore ?? createHabitsStore(),
		[habitsStore],
	);
	const [editing, setEditing] = useState<HeadingFormValues | null>(null);
	const [busy, setBusy] = useState(false);
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setError,
	} = useFocusStoreLoad(
		useCallback(async (): Promise<Snapshot> => {
			const detail = await reviews.loadHeading(id);
			const areaSlug = detail?.heading.goal.areaSlug ?? null;
			return {
				detail,
				practices:
					areaSlug === null ? [] : await habits.loadAreaPractices(areaSlug),
			};
		}, [habits, id, reviews]),
	);

	async function mutate(work: () => Promise<unknown>): Promise<boolean> {
		if (busy) return false;
		setBusy(true);
		setError(null);
		try {
			await work();
			await reload();
			return true;
		} catch (caught) {
			setError(toMessage(caught));
			return false;
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!snapshot?.detail) {
		return (
			<Screen centered padded>
				<EmptyState
					title={error ? t("heading.loadFailed") : t("heading.notFound")}
					body={error ?? t("heading.notFoundBody")}
					actionLabel={error ? t("common:actions.tryAgain") : undefined}
					onAction={error ? () => void reload() : undefined}
					tone={error ? "danger" : "default"}
				/>
			</Screen>
		);
	}

	const { heading, areaOptions } = snapshot.detail;
	const { goal, status } = heading;
	const activity = snapshot.practices
		.flatMap((practice) =>
			practice.recentDays.map((localDay) => ({
				key: `${practice.habit.id}:${localDay}`,
				localDay,
				label: practice.label,
			})),
		)
		.sort((left, right) => right.localDay.localeCompare(left.localDay))
		.slice(0, 5);

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<View style={styles.headingCopy}>
				<AppText variant="largeTitle">{goal.name}</AppText>
				<HeadingStatusBadge
					status={status}
					label={t(`goals.status.${status}`)}
				/>
			</View>

			<Card style={styles.aim}>
				<AppText variant="section">
					{goal.intent ??
						(heading.targetFormatted === null
							? t("goals.noTarget")
							: t("goals.targetValue", { value: heading.targetFormatted }))}
				</AppText>
				<AppText variant="caption" color="muted">
					{t("heading.started", {
						date: formatReviewDate(goal.startedAt),
					})}
				</AppText>
				{heading.targetFormatted !== null ? (
					<AppText variant="caption" color="muted">
						{t("heading.measured", {
							current:
								heading.currentFormatted === null
									? t("goals.currentValueUnknown")
									: t("goals.currentValue", {
											value: heading.currentFormatted,
										}),
							target: t("goals.targetValue", {
								value: heading.targetFormatted,
							}),
						})}
					</AppText>
				) : null}
				{goal.targetDate ? (
					<AppText variant="caption" color="subtle">
						{t("goals.targetDate", { date: goal.targetDate })}
					</AppText>
				) : null}
				{goal.note ? <AppText color="muted">{goal.note}</AppText> : null}
			</Card>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader
					title={t("heading.practiceTitle")}
					eyebrow={t("heading.practiceEyebrow")}
				/>
				{snapshot.practices.length === 0 ? (
					<AppText color="muted">{t("heading.practiceEmpty")}</AppText>
				) : (
					snapshot.practices.map((practice) => (
						<PracticeRow
							key={practice.habit.id}
							label={practice.label}
							progressLabel={practice.progressLabel}
							statusLabel={
								practice.completed
									? t("heading.practiceDone")
									: practice.recentDays[0]
										? t("heading.practiceLast", {
												date: formatReadingDay(practice.recentDays[0]),
											})
										: t("heading.practiceNotDone")
							}
							actionLabel={
								practice.habit.kind === "manual" && !practice.completed
									? t("heading.practiceMarkDone")
									: null
							}
							busy={busy}
							onAction={() =>
								void mutate(() =>
									habits.toggleManual(practice.habit.id, localDayOf(now())),
								)
							}
						/>
					))
				)}
				<TextAction
					label={t("heading.practiceManage")}
					chevron
					onPress={() => router.push("/habits")}
				/>
			</View>

			<View style={styles.section}>
				<SectionHeader title={t("heading.activityTitle")} />
				{activity.length === 0 ? (
					<AppText color="muted">{t("heading.activityEmpty")}</AppText>
				) : (
					activity.map((entry) => (
						<View key={entry.key} style={styles.activityRow}>
							<AppText color="muted" style={styles.activityDay}>
								{formatReadingDay(entry.localDay)}
							</AppText>
							<AppText variant="caption">{entry.label}</AppText>
						</View>
					))
				)}
			</View>

			<Button
				label={t("heading.edit")}
				variant="secondary"
				disabled={busy}
				onPress={() =>
					setEditing({
						name: goal.name,
						intent: goal.intent ?? "",
						areaSlug: goal.areaSlug,
						startedOn: localDayOf(new Date(goal.startedAt)),
						targetDate: goal.targetDate ?? "",
						note: goal.note ?? "",
					})
				}
			/>

			{status === "active" ? (
				<View style={styles.section}>
					<AppText variant="caption" color="muted">
						{t("heading.archiveBody")}
					</AppText>
					<Button
						label={t("heading.archive")}
						variant="text"
						disabled={busy}
						onPress={() => void mutate(() => reviews.achieveGoal(goal.id))}
					/>
					<AppText variant="caption" color="muted">
						{t("heading.removeBody")}
					</AppText>
					<Button
						label={t("heading.remove")}
						variant="text"
						tone="danger"
						disabled={busy}
						onPress={() => void mutate(() => reviews.abandonGoal(goal.id))}
					/>
				</View>
			) : (
				<AppText variant="caption" color="muted">
					{t("heading.reopenBody")}
				</AppText>
			)}

			<HeadingFormSheet
				visible={editing !== null}
				mode="edit"
				values={
					editing ?? {
						name: "",
						intent: "",
						areaSlug: null,
						startedOn: localDayOf(now()),
						targetDate: "",
						note: "",
					}
				}
				areaOptions={areaOptions}
				busy={busy}
				error={error}
				onChange={setEditing}
				onClose={() => setEditing(null)}
				onSave={() => {
					const values = editing;
					if (!values) return;
					void mutate(async () => {
						await reviews.updateHeading(goal.id, {
							name: values.name,
							intent: values.intent,
							areaSlug: values.areaSlug,
							targetDate: values.targetDate.trim() || null,
							startedAt: resolveLocalMoment({
								localDay: values.startedOn,
								time: "12:00",
							}).occurredAt,
							note: values.note,
						});
						setEditing(null);
					});
				}}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.lg },
	headingCopy: { gap: theme.spacing.sm, alignItems: "flex-start" },
	aim: { gap: theme.spacing.xs },
	section: { gap: theme.spacing.md },
	activityRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
		minHeight: theme.control.minHitArea,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.line,
	},
	activityDay: { flexShrink: 1 },
}));

export default HeadingDetailScreen;
