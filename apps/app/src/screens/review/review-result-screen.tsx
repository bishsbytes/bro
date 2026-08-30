import { router } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { WheelChart } from "../../components/wheel-chart";
import { challengeForArea, habitsForArea } from "../../content";
import { useStoreLoad } from "../../lib/use-store-load";
import { lifeAreaIconName } from "../../review/life-area-icons";
import {
	assessmentDate,
	formatReviewDate,
	formatScore,
} from "../../review/review-presentation";
import { createReviewStore, type ReviewStore } from "../../review/review-store";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

type ReviewResultScreenProps = {
	assessmentId: string;
	store?: Pick<ReviewStore, "loadResult">;
};

function formatDelta(t: TFunction<"review">, value: number): string {
	if (value === 0) {
		return t("result.noChange");
	}
	return `${value > 0 ? "+" : ""}${formatScore(value)}`;
}

export function ReviewResultScreen({
	assessmentId,
	store,
}: ReviewResultScreenProps) {
	const { t } = useTranslation("review");
	const { theme } = useUnistyles();
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const {
		data: result,
		error,
		loading,
	} = useStoreLoad(
		useCallback(
			() => reviews.loadResult(assessmentId),
			[assessmentId, reviews],
		),
	);

	if (loading) {
		return <LoadingScreen />;
	}

	if (!result || error) {
		return (
			<Screen padded centered>
				<EmptyState
					title={t("result.notFound")}
					body={error ?? t("result.notFoundBody")}
					actionLabel={t("backToReviews")}
					onAction={() => router.replace("/review")}
				/>
			</Screen>
		);
	}

	const comparisonBySlug = new Map(
		result.comparisons.map((comparison) => [comparison.slug, comparison]),
	);
	const completed = formatReviewDate(assessmentDate(result.assessment));

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<View>
				<AppText variant="display">{t("result.title")}</AppText>
				<AppText color="muted">
					{t("result.completed", { date: completed })}
				</AppText>
			</View>

			{result.scores.length >= 3 ? (
				<WheelChart
					scores={result.scores}
					previousScores={result.previousScores}
				/>
			) : null}

			<SectionHeader
				title={t("result.lifeAreas")}
				action={
					result.previousAssessment ? (
						<AppText variant="caption" color="muted">
							{t("result.comparedWithPrevious")}
						</AppText>
					) : null
				}
			/>

			{result.scores.map((score) => {
				const comparison = comparisonBySlug.get(score.slug);
				const challenge = challengeForArea(score.slug);
				return (
					<Card key={score.slug} style={styles.scoreCard}>
						<View style={styles.scoreHeading}>
							<Icon
								name={lifeAreaIconName(score.slug)}
								size={theme.control.focusIconSize}
								color={
									score.focused ? theme.colors.brand : theme.colors.textMuted
								}
							/>
							<View style={styles.labelGroup}>
								<AppText variant="label" style={styles.label}>
									{score.label}
								</AppText>
								{score.focused ? (
									<AppText variant="caption" color="brand">
										{t("result.focus")}
									</AppText>
								) : null}
							</View>
							<AppText variant="score">
								{t("scoreOutOf", { value: formatScore(score.value) })}
							</AppText>
						</View>
						{comparison ? (
							<View>
								<AppText
									variant="caption"
									color={comparison.delta === 0 ? "muted" : "brand"}
								>
									{t("result.delta", {
										delta: formatDelta(t, comparison.delta),
										previous: formatScore(comparison.previousValue),
									})}
								</AppText>
								{comparison.previousLabel !== comparison.label ? (
									<AppText variant="caption" color="subtle">
										{t("result.previousLabel", {
											label: comparison.previousLabel,
										})}
									</AppText>
								) : null}
							</View>
						) : result.previousAssessment ? (
							<AppText variant="caption" color="muted">
								{t("result.notPreviouslyRated")}
							</AppText>
						) : null}
						{score.focused ? (
							<View style={styles.nextActions}>
								<Button
									label={t("result.setGoal", { area: score.label })}
									variant="secondary"
									onPress={() =>
										router.push({
											pathname: "/review/goal",
											params: {
												assessmentId: result.assessment.id,
												metricSlug: score.slug,
											},
										})
									}
								/>
								{challenge ? (
									<Button
										label={t("result.readChallenge", {
											title: challenge.title,
										})}
										variant="text"
										onPress={() =>
											router.push({
												pathname: "/review/challenge/[slug]",
												params: { slug: challenge.slug },
											})
										}
									/>
								) : null}
								{habitsForArea(score.slug)
									.slice(0, 2)
									.map((template) => (
										<Button
											key={template.slug}
											label={t("result.addHabit", { label: template.label })}
											variant="text"
											onPress={() =>
												router.push({
													pathname: "/habits",
													params: { add: template.slug },
												})
											}
										/>
									))}
							</View>
						) : null}
					</Card>
				);
			})}

			{!result.previousAssessment ? (
				<AppText color="muted">{t("result.firstSnapshot")}</AppText>
			) : null}

			<Button
				label={t("result.takeStockAgain")}
				accessibilityLabel={t("result.takeStockAgain")}
				onPress={() => router.push("/review/new")}
			/>
			<Button
				label={t("backToReviews")}
				variant="secondary"
				onPress={() => router.replace("/review")}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.lg },
	scoreCard: { gap: theme.spacing.sm },
	scoreHeading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	labelGroup: { flex: 1, gap: theme.spacing.xs },
	label: { fontWeight: "600" },
	nextActions: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
}));
