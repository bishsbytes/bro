import { resolveLocalMoment } from "@bro/domain";
import { isWheelReviewDue } from "@bro/logic";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LifeAreaRow } from "../../components/life-area-row";
import { ListRow } from "../../components/list-row";
import { LoadingScreen, Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { SupportLink } from "../../components/support-link";
import { TextAction } from "../../components/text-action";
import { WheelChart } from "../../components/wheel-chart";
import {
	createHabitsStore,
	type HabitsStore,
	type TodayHabitsSnapshot,
} from "../../habits/habits-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	formatReviewDate,
	formatScore,
} from "../../review/review-presentation";
import {
	createReviewStore,
	type GoalProgress,
	type LifeAreaOption,
	type ReviewOverview,
	type ReviewResult,
	type ReviewStore,
} from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";
import { HeadingCard } from "./heading-card";
import {
	emptyHeadingForm,
	HeadingFormSheet,
	type HeadingFormValues,
} from "./heading-form-sheet";

type LifeScreenProps = {
	reviewStore?: Pick<
		ReviewStore,
		"loadOverview" | "loadLatestWheel" | "loadLifeAreaOptions" | "createHeading"
	>;
	habitsStore?: Pick<HabitsStore, "loadToday">;
	now?: () => Date;
};

type LifeSnapshot = {
	overview: ReviewOverview;
	latest: ReviewResult | null;
	habits: TodayHabitsSnapshot;
	areaOptions: LifeAreaOption[];
};

/**
 * L01 Life overview: where life stands, the direction set from it, and the
 * practices underneath. The wheel leads as one card, dated by the review it
 * came from; everything below it reads as a list.
 */
export function LifeScreen({ reviewStore, habitsStore, now }: LifeScreenProps) {
	const { t } = useTranslation(["life", "common"]);
	const reviews = useMemo(
		() => reviewStore ?? createReviewStore(),
		[reviewStore],
	);
	const habits = useMemo(
		() => habitsStore ?? createHabitsStore(),
		[habitsStore],
	);
	const [draft, setDraft] = useState<HeadingFormValues | null>(null);
	const [saving, setSaving] = useState(false);
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setError,
	} = useFocusStoreLoad(
		useCallback(async (): Promise<LifeSnapshot> => {
			const [overview, latest, habitsToday, areaOptions] = await Promise.all([
				reviews.loadOverview(),
				reviews.loadLatestWheel(),
				habits.loadToday(),
				reviews.loadLifeAreaOptions(),
			]);
			return { overview, latest, habits: habitsToday, areaOptions };
		}, [habits, reviews]),
	);

	async function saveHeading(values: HeadingFormValues) {
		if (saving) return;
		setSaving(true);
		setError(null);
		try {
			await reviews.createHeading({
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
			setDraft(null);
			await reload();
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return <LoadingScreen variant="tab" />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const { latest, overview } = snapshot;
	const currentTime = (now ?? (() => new Date()))();
	const completedAt = latest?.assessment.completedAt ?? null;
	const reviewDue = isWheelReviewDue(completedAt, currentTime.getTime());
	const focusAreas = latest?.scores.filter((score) => score.focused) ?? [];
	// A measurable heading reads as its numbers; a qualitative one as the words
	// its owner wrote. Neither is dressed up as the other.
	const headingAim = (progress: GoalProgress): string =>
		progress.targetFormatted === null
			? (progress.goal.intent ?? t("goals.noTarget"))
			: t("goals.summary", {
					current:
						progress.currentFormatted === null
							? t("goals.currentValueUnknown")
							: t("goals.currentValue", { value: progress.currentFormatted }),
					target: t("goals.targetValue", { value: progress.targetFormatted }),
				});
	const completedHabits = snapshot.habits.habits.filter(
		(item) => item.completed,
	).length;
	const habitDetail = snapshot.habits.hasHabits
		? snapshot.habits.habits.length === 0
			? t("habits.none")
			: t("habits.progress", {
					total: snapshot.habits.habits.length,
					done: completedHabits,
				})
		: t("habits.noRoutine");

	return (
		<Screen scroll padded gap="xl" contentContainerStyle={styles.content}>
			{latest && completedAt !== null ? (
				<View style={styles.section}>
					<Card style={styles.wheelCard}>
						<View style={styles.wheelCopy}>
							<AppText variant="section">{t("wheel.title")}</AppText>
							<AppText variant="caption" color="muted">
								{t("wheel.reviewedEyebrow", {
									date: formatReviewDate(completedAt),
								})}
							</AppText>
						</View>
						{latest.scores.length >= 3 ? (
							<WheelChart
								scores={latest.scores}
								previousScores={latest.previousScores}
							/>
						) : null}
						<Button
							label={t("wheel.openLatest")}
							variant="secondary"
							onPress={() =>
								router.push({
									pathname: "/review/[id]",
									params: { id: latest.assessment.id },
								})
							}
						/>
					</Card>
					<TextAction
						label={t("wheel.manageAreas")}
						chevron
						onPress={() => router.push("/life-areas")}
					/>
				</View>
			) : (
				<Card style={styles.hero}>
					<SectionHeader
						title={t("wheel.emptyTitle")}
						eyebrow={t("wheel.emptyEyebrow")}
					/>
					<AppText color="muted">{t("wheel.emptyBody")}</AppText>
					<Button
						label={t("wheel.takeStock")}
						accessibilityLabel={t("wheel.takeStock")}
						onPress={() => router.push("/review/new")}
					/>
					<TextAction
						label={t("wheel.manageAreas")}
						onPress={() => router.push("/life-areas")}
					/>
				</Card>
			)}

			{focusAreas.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader
						title={t("focus.title")}
						eyebrow={t("focus.eyebrow")}
					/>
					{focusAreas.map((score) => (
						<LifeAreaRow
							key={score.slug}
							label={score.label}
							value={score.value}
							valueLabel={t("common:wheel.scoreOfScale", {
								value: formatScore(score.value),
								max: 10,
							})}
						/>
					))}
				</View>
			) : null}

			<View style={styles.section}>
				<SectionHeader
					title={t("goals.title")}
					eyebrow={t("goals.eyebrow")}
					action={
						<TextAction
							label={t("heading.add")}
							onPress={() => setDraft(emptyHeadingForm(currentTime))}
						/>
					}
				/>
				{overview.goals.map((progress) => (
					<HeadingCard
						key={progress.goal.id}
						label={progress.label}
						status={progress.status}
						statusLabel={t(`goals.status.${progress.status}`)}
						summary={headingAim(progress)}
						detail={
							progress.goal.targetDate
								? t("goals.targetDate", { date: progress.goal.targetDate })
								: null
						}
						onPress={() =>
							router.push({
								pathname: "/headings/[id]",
								params: { id: progress.goal.id },
							})
						}
					/>
				))}
			</View>

			<View style={styles.section}>
				<SectionHeader
					title={t("habits.title")}
					eyebrow={t("habits.eyebrow")}
				/>
				<ListRow
					title={t("habits.rowTitle")}
					detail={habitDetail}
					accessibilityLabel={t("habits.manage")}
					onPress={() => router.push("/habits")}
				/>
			</View>

			{latest && reviewDue ? (
				<Card style={styles.hero}>
					<SectionHeader
						title={t("wheel.dueTitle")}
						eyebrow={t("wheel.dueEyebrow")}
					/>
					<AppText color="muted">{t("wheel.dueBody")}</AppText>
					<Button
						label={t("wheel.takeStock")}
						accessibilityLabel={t("wheel.takeStock")}
						onPress={() => router.push("/review/new")}
					/>
				</Card>
			) : null}
			<SupportLink />

			<HeadingFormSheet
				visible={draft !== null}
				mode="create"
				values={draft ?? emptyHeadingForm(currentTime)}
				areaOptions={snapshot.areaOptions}
				busy={saving}
				error={error}
				onChange={setDraft}
				onClose={() => setDraft(null)}
				onSave={() => {
					if (draft) void saveHeading(draft);
				}}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { paddingBottom: theme.control.fabClearance },
	section: { gap: theme.spacing.md },
	hero: { gap: theme.spacing.md },
	wheelCard: { gap: theme.spacing.lg },
	wheelCopy: { gap: theme.spacing.xs },
}));

export default LifeScreen;
