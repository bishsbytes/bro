import type { Assessment } from "@bro/database-app";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createReviewStore,
	type ReviewOverview,
	type ReviewStore,
} from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";

type ReviewScreenProps = {
	store?: Pick<ReviewStore, "loadOverview" | "achieveGoal" | "abandonGoal">;
};

function completedLabel(assessment: Assessment): string {
	return new Date(
		assessment.completedAt ?? assessment.startedAt,
	).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function ReviewScreen({ store }: ReviewScreenProps) {
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const [overview, setOverview] = useState<ReviewOverview | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setOverview(await reviews.loadOverview());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [reviews]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

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
				await load();
			} catch (caught) {
				setError(caught instanceof Error ? caught.message : String(caught));
			} finally {
				setUpdatingGoalId(null);
			}
		},
		[load, reviews],
	);

	if (!overview && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			{overview && overview.goals.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader title="Goals" eyebrow="WHAT YOU'RE WORKING ON" />
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
									{progress.status === "active"
										? "Active"
										: progress.status === "achieved"
											? "Achieved"
											: "Stopped"}
								</AppText>
							</View>
							<AppText color="muted">
								{progress.startFormatted === null
									? "No starting value"
									: `Started at ${progress.startFormatted}`}
								{" · "}
								{progress.currentFormatted === null
									? "No current value"
									: `Latest ${progress.currentFormatted}`}
								{" · "}Target {progress.targetFormatted}
							</AppText>
							{progress.goal.targetDate ? (
								<AppText variant="caption" color="subtle">
									Target date {progress.goal.targetDate}
								</AppText>
							) : null}
							{progress.targetReached ? (
								<AppText variant="caption" color="brand">
									Target reached — mark it achieved?
								</AppText>
							) : progress.status === "active" &&
								progress.progressPercent !== null ? (
								<AppText variant="caption" color="brand">
									{progress.progressPercent}% of the way
								</AppText>
							) : null}
							{progress.status === "active" ? (
								<View style={styles.goalActions}>
									<Button
										label={`Mark ${progress.label} achieved`}
										variant="secondary"
										loading={updatingGoalId === progress.goal.id}
										onPress={() => void updateGoal(progress.goal.id, "achieve")}
									/>
									<Button
										label={`Stop ${progress.label} goal`}
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
				title="Review history"
				eyebrow="WHEEL OF LIFE"
				action={
					<Button
						label="Take stock"
						variant="text"
						onPress={() => router.push("/review/new")}
					/>
				}
			/>

			{error ? (
				<EmptyState
					title="Reviews could not be loaded"
					body={error}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			) : null}

			{overview?.sittings.length === 0 ? (
				<EmptyState
					title="No reviews yet"
					body="Rate the areas of your life to see where things stand today."
				/>
			) : null}

			{overview?.sittings.map((assessment) => (
				<ListRow
					key={assessment.id}
					accessibilityLabel={`Open review ${completedLabel(assessment)}`}
					title={completedLabel(assessment)}
					detail={`${assessment.items.length} life areas`}
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
