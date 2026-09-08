import {
	CHECK_IN_SLOTS,
	type CheckInSlot,
	suggestedCheckInSlot,
} from "@bro/domain/metric-registry";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	checkInScoreSummary,
	checkInSourceStamp,
} from "../../check-in/check-in-presentation";
import type { TodayCheckIn } from "../../check-in/check-in-store";
import { AppText } from "../../components/app-text";
import { CheckInCard } from "../../components/check-in-card";
import { SectionHeader } from "../../components/section-header";
import { StyleSheet } from "../../theme/unistyles";

type CheckInSittingsSectionProps = {
	today: TodayCheckIn;
	now: Date;
	error: string | null;
	onOpenSitting: (slot: CheckInSlot) => void;
};

/**
 * One invitation leads; the other sitting stays compact. Saved cards show the
 * actual answers, any missing dimensions and the event metadata.
 */
export function CheckInSittingsSection({
	today,
	now,
	error,
	onOpenSitting,
}: CheckInSittingsSectionProps) {
	const { t } = useTranslation(["home", "checkIn"]);
	const suggested = suggestedCheckInSlot(now);

	return (
		<View style={styles.section}>
			<SectionHeader title={t("checkIn:sittings.title")} />
			<View style={styles.sittings}>
				{CHECK_IN_SLOTS.map((slot) => {
					const sitting = today.sittings[slot];
					const name = t(`checkIn:slots.${slot}.name`);
					const summary = sitting ? checkInScoreSummary(sitting) : null;
					const featured = !sitting && slot === suggested;
					const missing = sitting
						? today.availableOptionalScores[slot]
								.filter(
									(metric) =>
										!sitting.optionalScores.some(
											(score) => score.metricSlug === metric.slug,
										),
								)
								.map((metric) => metric.label)
						: [];
					const partialLabel =
						missing.length > 0
							? t("checkIn:sittings.partial", { labels: missing.join(", ") })
							: null;

					return (
						<CheckInCard
							key={slot}
							name={name}
							summary={summary}
							tagline={t(`checkIn:slots.${slot}.tagline`)}
							featured={featured}
							statusLabel={
								sitting
									? t(
											missing.length > 0
												? "checkIn:sittings.partialStatus"
												: "checkIn:sittings.complete",
										)
									: null
							}
							dimensionsLabel={
								featured
									? t("checkIn:sittings.dimensions", {
											labels: [
												t("checkIn:steps.moodLabel"),
												...today.availableOptionalScores[slot].map(
													(metric) => metric.label,
												),
											].join(", "),
										})
									: null
							}
							startLabel={featured ? t("checkIn:sittings.start") : null}
							partialLabel={partialLabel}
							sourceStamp={sitting ? checkInSourceStamp(sitting) : null}
							accessibilityLabel={
								summary
									? t("checkIn:sittings.editA11y", { sitting: name, summary })
									: t("checkIn:sittings.startA11y", { sitting: name })
							}
							accessibilityHint={
								sitting
									? [
											checkInSourceStamp(sitting),
											partialLabel ?? t("checkIn:sittings.complete"),
										].join(". ")
									: undefined
							}
							onPress={() => onOpenSitting(slot)}
						/>
					);
				})}
			</View>
			{error ? <AppText color="danger">{error}</AppText> : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { marginBottom: theme.spacing.xl, gap: theme.spacing.md },
	/** Sittings stack and grow with their summaries and any unanswered dimensions. */
	sittings: { gap: theme.spacing.sm },
}));
