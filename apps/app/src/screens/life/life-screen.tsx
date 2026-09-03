import { isWheelReviewDue } from "@bro/logic";
import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { ListRow } from "../../components/list-row";
import { LoadingScreen, Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { WheelChart } from "../../components/wheel-chart";
import {
	createHabitsStore,
	type HabitsStore,
	type TodayHabitsSnapshot,
} from "../../habits/habits-store";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { lifeAreaIconName } from "../../review/life-area-icons";
import { formatReviewDate } from "../../review/review-presentation";
import {
	createReviewStore,
	type ReviewOverview,
	type ReviewResult,
	type ReviewStore,
} from "../../review/review-store";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

type LifeScreenProps = {
	reviewStore?: Pick<ReviewStore, "loadOverview" | "loadLatestWheel">;
	habitsStore?: Pick<HabitsStore, "loadToday">;
	now?: () => Date;
};

type LifeSnapshot = {
	overview: ReviewOverview;
	latest: ReviewResult | null;
	habits: TodayHabitsSnapshot;
};

export function LifeScreen({ reviewStore, habitsStore, now }: LifeScreenProps) {
	const { t } = useTranslation(["life", "common"]);
	const { theme } = useUnistyles();
	const reviews = useMemo(
		() => reviewStore ?? createReviewStore(),
		[reviewStore],
	);
	const habits = useMemo(
		() => habitsStore ?? createHabitsStore(),
		[habitsStore],
	);
	const {
		data: snapshot,
		error,
		loading,
		reload,
	} = useFocusStoreLoad(
		useCallback(async (): Promise<LifeSnapshot> => {
			const [overview, latest, habitsToday] = await Promise.all([
				reviews.loadOverview(),
				reviews.loadLatestWheel(),
				habits.loadToday(),
			]);
			return { overview, latest, habits: habitsToday };
		}, [habits, reviews]),
	);

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
	const completedAt = latest?.assessment.completedAt ?? null;
	const reviewDue = isWheelReviewDue(
		completedAt,
		(now ?? (() => new Date()))().getTime(),
	);
	const focusAreas = latest?.scores.filter((score) => score.focused) ?? [];
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
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("intro")}</AppText>

			{latest && completedAt !== null ? (
				<View style={styles.section}>
					<SectionHeader
						title={t("wheel.title")}
						eyebrow={t("wheel.reviewedEyebrow", {
							date: formatReviewDate(completedAt),
						})}
					/>
					{latest.scores.length >= 3 ? (
						<WheelChart
							scores={latest.scores}
							previousScores={latest.previousScores}
						/>
					) : null}
					<View style={styles.actions}>
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
						<Button
							label={t("wheel.manageAreas")}
							variant="text"
							onPress={() => router.push("/life-areas")}
						/>
					</View>
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
					<Button
						label={t("wheel.manageAreas")}
						variant="text"
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
						<Card key={score.slug} style={styles.focusRow}>
							<Icon
								name={lifeAreaIconName(score.slug)}
								size={theme.control.focusIconSize}
								color={theme.colors.textMuted}
							/>
							<AppText variant="label" style={styles.grow}>
								{score.label}
							</AppText>
							<AppText variant="score">
								{t("focus.scoreOutOf", { value: score.value })}
							</AppText>
						</Card>
					))}
				</View>
			) : null}

			{overview.goals.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader
						title={t("goals.title")}
						eyebrow={t("goals.eyebrow")}
					/>
					{overview.goals.map((progress) => (
						<Card key={progress.goal.id} style={styles.goalCard}>
							<View style={styles.focusRow}>
								<AppText variant="label" style={styles.grow}>
									{progress.label}
								</AppText>
								<AppText variant="caption" color="brand">
									{progress.status === "active"
										? t("goals.statusActive")
										: progress.status === "achieved"
											? t("goals.statusAchieved")
											: t("goals.statusAbandoned")}
								</AppText>
							</View>
							<AppText color="muted">
								{t("goals.summary", {
									current:
										progress.currentFormatted === null
											? t("goals.currentValueUnknown")
											: t("goals.currentValue", {
													value: progress.currentFormatted,
												}),
									target: t("goals.targetValue", {
										value: progress.targetFormatted,
									}),
								})}
							</AppText>
						</Card>
					))}
				</View>
			) : null}

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
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	hero: { gap: theme.spacing.md },
	actions: { gap: theme.spacing.sm },
	focusRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	goalCard: { gap: theme.spacing.sm },
	grow: { flex: 1 },
}));

export default LifeScreen;
