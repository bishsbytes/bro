import { challengeForArea } from "@bro/domain/challenge-catalogue";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { StackScreen as Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import { WheelChart } from "../components/wheel-chart";
import {
	createReviewStore,
	type ReviewResult,
	type ReviewStore,
} from "../review/review-store";
import { StyleSheet } from "../theme/unistyles";

type ReviewResultScreenProps = {
	assessmentId: string;
	store?: Pick<ReviewStore, "loadResult">;
};

function formatScore(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDelta(value: number): string {
	if (value === 0) {
		return "No change";
	}
	return `${value > 0 ? "+" : ""}${formatScore(value)}`;
}

export function ReviewResultScreen({
	assessmentId,
	store,
}: ReviewResultScreenProps) {
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const [result, setResult] = useState<ReviewResult | null | undefined>(
		undefined,
	);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setResult(undefined);
		setError(null);
		void reviews
			.loadResult(assessmentId)
			.then(setResult)
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : String(caught)),
			);
	}, [assessmentId, reviews]);

	if (result === undefined && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	if (!result || error) {
		return (
			<Screen padded centered>
				<EmptyState
					title="Review not found"
					body={error ?? "This review is no longer on this device."}
					actionLabel="Back to reviews"
					onAction={() => router.replace("/review")}
				/>
			</Screen>
		);
	}

	const comparisonBySlug = new Map(
		result.comparisons.map((comparison) => [comparison.slug, comparison]),
	);
	const completed = new Date(
		result.assessment.completedAt ?? result.assessment.startedAt,
	).toLocaleDateString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<View>
				<AppText variant="display">Your wheel</AppText>
				<AppText color="muted">Completed {completed}</AppText>
			</View>

			{result.scores.length >= 3 ? (
				<WheelChart
					scores={result.scores}
					previousScores={result.previousScores}
				/>
			) : null}

			<SectionHeader
				title="Life areas"
				action={
					result.previousAssessment ? (
						<AppText variant="caption" color="muted">
							Compared with your previous review
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
							<View style={styles.labelGroup}>
								<AppText variant="label" style={styles.label}>
									{score.label}
								</AppText>
								{score.focused ? (
									<AppText variant="caption" color="brand">
										Focus
									</AppText>
								) : null}
							</View>
							<AppText variant="score">{formatScore(score.value)}/10</AppText>
						</View>
						{comparison ? (
							<View>
								<AppText
									variant="caption"
									color={comparison.delta === 0 ? "muted" : "brand"}
								>
									{formatDelta(comparison.delta)} from{" "}
									{formatScore(comparison.previousValue)}
								</AppText>
								{comparison.previousLabel !== comparison.label ? (
									<AppText variant="caption" color="subtle">
										Previously “{comparison.previousLabel}”
									</AppText>
								) : null}
							</View>
						) : result.previousAssessment ? (
							<AppText variant="caption" color="muted">
								Not rated in your previous review
							</AppText>
						) : null}
						{score.focused ? (
							<View style={styles.nextActions}>
								<Button
									label={`Set a goal for ${score.label}`}
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
										label={`Read “${challenge.title}”`}
										variant="text"
										onPress={() =>
											router.push({
												pathname: "/review/challenge/[slug]",
												params: { slug: challenge.slug },
											})
										}
									/>
								) : null}
							</View>
						) : null}
					</Card>
				);
			})}

			{!result.previousAssessment ? (
				<AppText color="muted">
					This is your first snapshot. Your next review will show what moved.
				</AppText>
			) : null}

			<Button
				label="Take stock again"
				onPress={() => router.push("/review/new")}
			/>
			<Button
				label="Back to reviews"
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
