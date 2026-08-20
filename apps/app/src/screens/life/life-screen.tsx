import { isWheelReviewDue } from "@bro/logic";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { LoadingIndicator } from "../../components/loading-indicator";
import { Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { WheelChart } from "../../components/wheel-chart";
import {
	createHabitsStore,
	type HabitsStore,
	type TodayHabitsSnapshot,
} from "../../habits/habits-store";
import {
	createReviewStore,
	type ReviewOverview,
	type ReviewResult,
	type ReviewStore,
} from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";

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

function completedLabel(completedAt: number): string {
	return new Date(completedAt).toLocaleDateString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

export function LifeScreen({ reviewStore, habitsStore, now }: LifeScreenProps) {
	const reviews = useMemo(
		() => reviewStore ?? createReviewStore(),
		[reviewStore],
	);
	const habits = useMemo(
		() => habitsStore ?? createHabitsStore(),
		[habitsStore],
	);
	const [snapshot, setSnapshot] = useState<LifeSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const [overview, latest, habitsToday] = await Promise.all([
				reviews.loadOverview(),
				reviews.loadLatestWheel(),
				habits.loadToday(),
			]);
			setSnapshot({ overview, latest, habits: habitsToday });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [habits, reviews]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

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
					title="Your life view could not be loaded"
					body={error ?? "Try again."}
					actionLabel="Try again"
					onAction={() => void load()}
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
			? "No habits scheduled today"
			: `${snapshot.habits.habits.length} today · ${completedHabits} complete`
		: "Choose a routine to keep the next small action in view";

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">
				See where life stands, what you are focusing on, and the practices that
				move it forward.
			</AppText>

			{latest && completedAt !== null ? (
				<View style={styles.section}>
					<SectionHeader
						title="Your wheel"
						eyebrow={`REVIEWED ${completedLabel(completedAt).toUpperCase()}`}
					/>
					{latest.scores.length >= 3 ? (
						<WheelChart
							scores={latest.scores}
							previousScores={latest.previousScores}
						/>
					) : null}
					<View style={styles.actions}>
						<Button
							label="Open latest review"
							variant="secondary"
							onPress={() =>
								router.push({
									pathname: "/review/[id]",
									params: { id: latest.assessment.id },
								})
							}
						/>
						<Button
							label="Manage life areas"
							variant="text"
							onPress={() => router.push("/life-areas")}
						/>
					</View>
				</View>
			) : (
				<Card style={styles.hero}>
					<SectionHeader
						title="Take stock of the bigger picture"
						eyebrow="WHEEL OF LIFE"
					/>
					<AppText color="muted">
						Rate the areas of your life, choose where to focus, and create a
						first snapshot to come back to.
					</AppText>
					<Button
						label="Take stock"
						onPress={() => router.push("/review/new")}
					/>
					<Button
						label="Manage life areas"
						variant="text"
						onPress={() => router.push("/life-areas")}
					/>
				</Card>
			)}

			{focusAreas.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader title="Focus areas" eyebrow="WHAT MATTERS NOW" />
					{focusAreas.map((score) => (
						<Card key={score.slug} style={styles.focusRow}>
							<AppText variant="label">{score.label}</AppText>
							<AppText variant="score">{score.value}/10</AppText>
						</Card>
					))}
				</View>
			) : null}

			{overview.goals.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader title="Goals" eyebrow="YOUR DIRECTION" />
					{overview.goals.map((progress) => (
						<Card key={progress.goal.id} style={styles.goalCard}>
							<View style={styles.focusRow}>
								<AppText variant="label" style={styles.grow}>
									{progress.label}
								</AppText>
								<AppText variant="caption" color="brand">
									{progress.status === "active"
										? "Active"
										: progress.status === "achieved"
											? "Achieved"
											: "Stopped"}
								</AppText>
							</View>
							<AppText color="muted">
								{progress.currentFormatted === null
									? "No current value"
									: `Latest ${progress.currentFormatted}`}
								{" · "}Target {progress.targetFormatted}
							</AppText>
							{progress.status === "active" &&
							progress.progressPercent !== null ? (
								<AppText variant="caption" color="brand">
									{progress.progressPercent}% of the way
								</AppText>
							) : null}
						</Card>
					))}
				</View>
			) : null}

			<View style={styles.section}>
				<SectionHeader title="Habits" eyebrow="WHAT YOU PRACTISE" />
				<ListRow
					title="Your habits"
					detail={habitDetail}
					accessibilityLabel="Manage habits"
					onPress={() => router.push("/habits")}
				/>
			</View>

			{latest && reviewDue ? (
				<Card style={styles.hero}>
					<SectionHeader title="Time to take stock" eyebrow="WHEEL REVIEW" />
					<AppText color="muted">
						It has been more than five weeks since your last snapshot. See what
						has moved and choose your next focus.
					</AppText>
					<Button
						label="Take stock"
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
