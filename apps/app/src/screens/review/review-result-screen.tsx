import { router } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { EmptyState } from "../../components/empty-state";
import { LifeAreaRow } from "../../components/life-area-row";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { TextAction } from "../../components/text-action";
import { WheelChart } from "../../components/wheel-chart";
import { challengeForArea, habitsForArea } from "../../content";
import { useStoreLoad } from "../../lib/use-store-load";
import {
	assessmentDate,
	formatReviewDate,
	formatScore,
} from "../../review/review-presentation";
import { createReviewStore, type ReviewStore } from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";

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

/**
 * L02 Review detail: the same review the wheel draws, read as named values.
 * The chart stays for reviews the overview no longer leads with, and the rows
 * below it carry the precise scores and the comparison with last time.
 */
export function ReviewResultScreen({
	assessmentId,
	store,
}: ReviewResultScreenProps) {
	const { t } = useTranslation(["review", "common"]);
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
	const completedAt = assessmentDate(result.assessment);
	const completed = formatReviewDate(completedAt);
	const focusAreas = result.scores.filter((score) => score.focused);

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<View style={styles.heading}>
				<AppText variant="largeTitle">
					{t(result.isLatest ? "result.titleLatest" : "result.title")}
				</AppText>
				<AppText
					color="muted"
					accessibilityLabel={t("result.completed", { date: completed })}
				>
					{completed}
				</AppText>
			</View>

			{result.scores.length >= 3 ? (
				<WheelChart
					scores={result.scores}
					previousScores={result.previousScores}
					showValueToggle={false}
				/>
			) : null}

			<View style={styles.areas}>
				{result.scores.map((score) => {
					const comparison = comparisonBySlug.get(score.slug);
					return (
						<LifeAreaRow
							key={score.slug}
							label={score.label}
							value={score.value}
							valueLabel={t("common:wheel.scoreOfScale", {
								value: formatScore(score.value),
								max: 10,
							})}
							focusLabel={score.focused ? t("result.focus") : null}
							detail={
								comparison
									? t("result.delta", {
											delta: formatDelta(t, comparison.delta),
											previous: formatScore(comparison.previousValue),
										})
									: result.previousAssessment
										? t("result.notPreviouslyRated")
										: null
							}
							detailTone={
								comparison && comparison.delta !== 0 ? "mind" : "muted"
							}
							note={
								comparison && comparison.previousLabel !== comparison.label
									? t("result.previousLabel", {
											label: comparison.previousLabel,
										})
									: null
							}
						/>
					);
				})}
			</View>

			{result.previousAssessment ? (
				<TextAction
					label={t("result.viewPrevious")}
					chevron
					onPress={() =>
						router.push({
							pathname: "/review/[id]",
							params: { id: result.previousAssessment?.id ?? "" },
						})
					}
				/>
			) : (
				<AppText color="muted">{t("result.firstSnapshot")}</AppText>
			)}

			{focusAreas.length > 0 ? (
				<View style={styles.next}>
					<SectionHeader
						title={t("result.nextTitle")}
						eyebrow={t("result.nextEyebrow")}
					/>
					{focusAreas.map((score) => {
						const challenge = challengeForArea(score.slug);
						return (
							<View key={score.slug} style={styles.nextArea}>
								<AppText variant="label">{score.label}</AppText>
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
									<TextAction
										label={t("result.readChallenge", {
											title: challenge.title,
										})}
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
										<TextAction
											key={template.slug}
											label={t("result.addHabit", { label: template.label })}
											onPress={() =>
												router.push({
													pathname: "/habits",
													params: { add: template.slug },
												})
											}
										/>
									))}
							</View>
						);
					})}
				</View>
			) : null}

			<Button
				label={t("result.startNew")}
				accessibilityLabel={t("result.startNew")}
				onPress={() => router.push("/review/new")}
			/>
			<TextAction
				label={t("backToReviews")}
				onPress={() => router.replace("/review")}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.lg },
	heading: { gap: theme.spacing.xs },
	areas: { gap: theme.spacing.xs },
	next: { gap: theme.spacing.md },
	nextArea: { gap: theme.spacing.sm },
}));
