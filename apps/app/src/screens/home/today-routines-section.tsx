import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { PracticeRow } from "../../components/practice-row";
import { SectionHeader } from "../../components/section-header";
import { TextAction } from "../../components/text-action";
import type { TodayHabitsSnapshot } from "../../habits/habits-store";
import { StyleSheet } from "../../theme/unistyles";

type TodayRoutinesSectionProps = {
	habits: TodayHabitsSnapshot | null;
	busyId: string | null;
	error: string | null;
	/** The title of a challenge finished by the last completion, if any. */
	finishedChallenge: string | null;
	onDismissFinished: () => void;
	onToggleHabit: (habitId: string) => void;
	onCompleteChallengeDay: (enrolmentId: string, dayIndex: number) => void;
};

/** Today's practices and challenges, and the invitation to pick some. */
export function TodayRoutinesSection({
	habits,
	busyId,
	error,
	finishedChallenge,
	onDismissFinished,
	onToggleHabit,
	onCompleteChallengeDay,
}: TodayRoutinesSectionProps) {
	const { t } = useTranslation("home");
	const nothingChosen =
		habits !== null &&
		habits.habits.length === 0 &&
		habits.challenges.length === 0 &&
		!habits.hasHabits;

	return (
		<>
			{finishedChallenge ? (
				<Card style={styles.card}>
					<AppText variant="section">{t("challenges.completeTitle")}</AppText>
					<AppText color="muted">
						{t("challenges.completeBody", { name: finishedChallenge })}
					</AppText>
					<Button
						label={t("challenges.dismiss")}
						variant="text"
						onPress={onDismissFinished}
					/>
				</Card>
			) : null}
			{nothingChosen ? (
				<Card style={styles.card}>
					<AppText variant="section">{t("habits.emptyTitle")}</AppText>
					<AppText color="muted">{t("habits.emptyBody")}</AppText>
					<Button
						label={t("habits.choose")}
						variant="secondary"
						onPress={() => router.push("/habits")}
					/>
				</Card>
			) : null}
			{habits && habits.habits.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader
						title={t("habits.title")}
						action={
							<TextAction
								label={t("habits.manage")}
								onPress={() => router.push("/habits")}
							/>
						}
					/>
					{habits.habits.map((item) => (
						<PracticeRow
							key={item.habit.id}
							label={item.label}
							progressLabel={item.progressLabel}
							statusLabel={
								item.completed ? t("habits.doneToday") : t("habits.stillToDo")
							}
							actionLabel={
								item.habit.kind === "manual"
									? item.completed
										? t("habits.undo")
										: t("habits.markDone")
									: null
							}
							actionVariant={item.completed ? "text" : "secondary"}
							busy={busyId === item.habit.id}
							onAction={() => onToggleHabit(item.habit.id)}
						/>
					))}
				</View>
			) : null}
			{habits && habits.challenges.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader title={t("challenges.title")} />
					{habits.challenges.map((challenge) => (
						<Card key={challenge.enrolmentId} style={styles.card}>
							<AppText variant="caption" color="brand">
								{t("challenges.dayOf", {
									day: challenge.dayIndex,
									total: challenge.durationDays,
								})}
							</AppText>
							<AppText variant="section">{challenge.dayTitle}</AppText>
							<AppText color="muted">{challenge.action}</AppText>
							<Button
								label={t("challenges.markStepDone")}
								loading={busyId === challenge.enrolmentId}
								onPress={() =>
									onCompleteChallengeDay(
										challenge.enrolmentId,
										challenge.dayIndex,
									)
								}
							/>
							<TextAction
								label={t("challenges.view")}
								onPress={() =>
									router.push(`/challenges/${challenge.enrolmentId}`)
								}
							/>
						</Card>
					))}
				</View>
			) : null}
			{error ? <AppText color="danger">{error}</AppText> : null}
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	card: { gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
	section: { marginBottom: theme.spacing.xl, gap: theme.spacing.md },
}));
