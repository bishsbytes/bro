import type { Assessment } from "@bro/database-app";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	assessmentDate,
	formatReviewDate,
} from "../../review/review-presentation";
import { createReviewStore, type ReviewStore } from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";

type ReviewScreenProps = {
	store?: Pick<ReviewStore, "loadOverview" | "achieveGoal" | "abandonGoal">;
};

function completedLabel(assessment: Assessment): string {
	return formatReviewDate(assessmentDate(assessment), "short");
}

export function ReviewScreen({ store }: ReviewScreenProps) {
	// "review" leads, so unprefixed keys resolve there; "common" is declared so
	// shared copy can be reached with an explicit `common:` prefix.
	const { t } = useTranslation(["review", "common"]);
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);
	const {
		data: overview,
		error,
		loading,
		reload,
		setError,
	} = useFocusStoreLoad(useCallback(() => reviews.loadOverview(), [reviews]));

	const updateGoal = useCallback(
		async (id: string, action: "achieve" | "abandon") => {
			setUpdatingGoalId(id);
			setError(null);
			try {
				if (action === "achieve") {
					await reviews.achieveGoal(id);
				} else {
					await reviews.abandonGoal(id);
				}
				await reload();
			} catch (caught) {
				setError(toMessage(caught));
			} finally {
				setUpdatingGoalId(null);
			}
		},
		[reload, reviews, setError],
	);

	if (loading) {
		return <LoadingScreen />;
	}

	return (
		<Screen scroll padded gap="lg">
			{overview && overview.goals.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader
						title={t("goals.title")}
						eyebrow={t("goals.eyebrow")}
					/>
					{overview.goals.map((progress) => (
						<Card key={progress.goal.id} style={styles.goalCard}>
							<View style={styles.goalHeading}>
								<AppText variant="section" style={styles.goalLabel}>
									{progress.label}
								</AppText>
								<AppText
									variant="caption"
									color={progress.status === "active" ? "brand" : "muted"}
								>
									{t(`goals.status.${progress.status}`)}
								</AppText>
							</View>
							<AppText color="muted">
								{t("goals.summary", {
									start:
										progress.startFormatted === null
											? t("goals.startValueUnknown")
											: t("goals.startValue", {
													value: progress.startFormatted,
												}),
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
							{progress.goal.targetDate ? (
								<AppText variant="caption" color="subtle">
									{t("goals.targetDate", { date: progress.goal.targetDate })}
								</AppText>
							) : null}
							{progress.targetReached ? (
								<AppText variant="caption" color="brand">
									{t("goals.targetReached")}
								</AppText>
							) : progress.status === "active" &&
								progress.progressPercent !== null ? (
								<AppText variant="caption" color="brand">
									{t("goals.percentComplete", {
										percent: progress.progressPercent,
									})}
								</AppText>
							) : null}
							{progress.status === "active" ? (
								<View style={styles.goalActions}>
									<Button
										label={t("goals.achieve", { goal: progress.label })}
										variant="secondary"
										loading={updatingGoalId === progress.goal.id}
										onPress={() => void updateGoal(progress.goal.id, "achieve")}
									/>
									<Button
										label={t("goals.abandon", { goal: progress.label })}
										variant="text"
										disabled={updatingGoalId !== null}
										onPress={() => void updateGoal(progress.goal.id, "abandon")}
									/>
								</View>
							) : null}
						</Card>
					))}
				</View>
			) : null}

			<SectionHeader
				title={t("history.title")}
				eyebrow={t("history.eyebrow")}
				action={
					<Button
						label={t("history.takeStock")}
						accessibilityLabel={t("history.takeStock")}
						variant="text"
						onPress={() => router.push("/review/new")}
					/>
				}
			/>

			{error ? (
				<EmptyState
					title={t("history.loadFailed")}
					body={error}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			) : null}

			{overview?.sittings.length === 0 ? (
				<EmptyState
					title={t("history.emptyTitle")}
					body={t("history.emptyBody")}
				/>
			) : null}

			{overview?.sittings.map((assessment) => (
				<ListRow
					key={assessment.id}
					accessibilityLabel={t("history.open", {
						date: completedLabel(assessment),
					})}
					title={completedLabel(assessment)}
					detail={t("history.lifeAreas", { count: assessment.items.length })}
					onPress={() =>
						router.push({
							pathname: "/review/[id]",
							params: { id: assessment.id },
						})
					}
				/>
			))}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	goalCard: { gap: theme.spacing.sm },
	goalHeading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	goalLabel: { flex: 1 },
	goalActions: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
}));
