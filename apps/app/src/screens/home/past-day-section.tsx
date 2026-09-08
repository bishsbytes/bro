import { formatLocalDayLabel } from "@bro/logic";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	checkInScoreSummary,
	checkInSourceStamp,
	metricLabel,
} from "../../check-in/check-in-presentation";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { LoadingIndicator } from "../../components/loading-indicator";
import { PracticeRow } from "../../components/practice-row";
import { SectionHeader } from "../../components/section-header";
import type { TodayHabitsSnapshot } from "../../habits/habits-store";
import type {
	HistoryDay,
	HistoryMeasurementChange,
} from "../../history/history-store";
import { StyleSheet } from "../../theme/unistyles";
import { JournalNotesSection } from "./journal-notes-section";

function measurementChangeDetailLabel(
	t: TFunction<"home">,
	change: HistoryMeasurementChange,
): string {
	if (change.direction === "unchanged") {
		return t("measurements.unchanged");
	}
	return change.direction === "increase"
		? t("measurements.higher", { delta: change.formattedDelta })
		: t("measurements.lower", { delta: change.formattedDelta });
}

export type PastDaySectionProps = {
	localDay: string;
	todayLocalDay: string;
	day: HistoryDay | null;
	habits: TodayHabitsSnapshot | null;
	loading: boolean;
	error: string | null;
	routineError: string | null;
	routineBusy: string | null;
	onToggleHabit: (habitId: string) => void;
	onEdit: () => void;
	onAddNote: () => void;
	onOpenNotes: () => void;
};

/** A day the user has paged back to: what was recorded, and the way back in. */
export function PastDaySection({
	localDay,
	todayLocalDay,
	day,
	habits,
	loading,
	error,
	routineError,
	routineBusy,
	onToggleHabit,
	onEdit,
	onAddNote,
	onOpenNotes,
}: PastDaySectionProps) {
	const { t } = useTranslation(["home", "checkIn"]);

	return (
		<>
			<AppText variant="section" style={styles.pageTitle}>
				{formatLocalDayLabel(localDay, todayLocalDay)}
			</AppText>
			{loading ? <LoadingIndicator size="large" /> : null}
			{error ? <AppText color="danger">{error}</AppText> : null}
			{day ? (
				<>
					<View style={styles.section}>
						<SectionHeader title={t("checkIns.title")} />
						{day.checkIns.length === 0 ? (
							<Card>
								<AppText color="muted">{t("checkIns.none")}</AppText>
							</Card>
						) : (
							day.checkIns.map((checkIn) => (
								<Card key={checkIn.id} style={styles.savedSitting}>
									<AppText variant="eyebrow" color="muted">
										{t(`checkIn:slots.${checkIn.slot}.name`)}
									</AppText>
									<AppText variant="label">
										{checkInScoreSummary(checkIn)}
									</AppText>
									<AppText variant="caption" color="subtle">
										{checkInSourceStamp(checkIn)}
									</AppText>
								</Card>
							))
						)}
					</View>
					{day.tags.length > 0 ? (
						<View style={styles.section}>
							<SectionHeader title={t("tags.title")} />
							<Card>
								<AppText color="muted">
									{day.tags
										.map((tag) => metricLabel(tag.metricSlug))
										.join(", ")}
								</AppText>
							</Card>
						</View>
					) : null}
					{day.measurements.length > 0 ? (
						<View style={styles.section}>
							<SectionHeader title={t("measurements.title")} />
							{day.measurements.map((measurement) => (
								<Card key={measurement.id} style={styles.measurementCard}>
									<View style={styles.measurementHeader}>
										<AppText
											variant="caption"
											color="muted"
											style={styles.measurementLabel}
										>
											{measurement.label}
										</AppText>
									</View>
									<AppText variant="monoList">
										{measurement.formattedValue}
									</AppText>
									{measurement.changeFromPreviousDay ? (
										<AppText variant="footnote" color="subtle">
											{measurementChangeDetailLabel(
												t,
												measurement.changeFromPreviousDay,
											)}
										</AppText>
									) : null}
								</Card>
							))}
						</View>
					) : null}
					<JournalNotesSection
						notes={day.notes}
						todayLocalDay={todayLocalDay}
						onAddNote={onAddNote}
						onOpenNotes={onOpenNotes}
					/>
				</>
			) : null}
			{habits && habits.habits.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader title={t("habits.title")} />
					{habits.habits.map((item) => (
						<PracticeRow
							key={item.habit.id}
							label={item.label}
							progressLabel={item.progressLabel}
							statusLabel={
								item.completed ? t("habits.doneOnDay") : t("habits.notDone")
							}
							actionLabel={
								item.habit.kind === "manual"
									? item.completed
										? t("habits.undo")
										: t("habits.markDone")
									: null
							}
							actionVariant={item.completed ? "text" : "secondary"}
							busy={routineBusy === item.habit.id}
							onAction={() => onToggleHabit(item.habit.id)}
						/>
					))}
				</View>
			) : null}
			{routineError ? <AppText color="danger">{routineError}</AppText> : null}
			{day && habits ? (
				<Button
					label={t("pastDay.edit")}
					variant="secondary"
					onPress={onEdit}
				/>
			) : null}
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	pageTitle: { marginBottom: theme.spacing.lg },
	section: { marginBottom: theme.spacing.xl, gap: theme.spacing.md },
	savedSitting: { gap: theme.spacing.sm },
	measurementCard: { gap: theme.spacing.xs },
	measurementHeader: {
		width: "100%",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.sm,
	},
	measurementLabel: { flex: 1 },
}));
