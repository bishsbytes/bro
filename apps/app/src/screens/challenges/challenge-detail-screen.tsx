import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import {
	type ChallengeDetail,
	createHabitsStore,
	type HabitsStore,
} from "../../habits/habits-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type ChallengeDetailStore = Pick<
	HabitsStore,
	| "loadChallenge"
	| "completeChallengeDay"
	| "abandonChallenge"
	| "startChallenge"
>;

export function ChallengeDetailScreen({
	enrolmentId,
	store,
}: {
	enrolmentId: string;
	store?: ChallengeDetailStore;
}) {
	const { t } = useTranslation("challenges");
	const challenges = useMemo(() => store ?? createHabitsStore(), [store]);
	const [busy, setBusy] = useState(false);
	const {
		data: detail,
		error,
		loading,
		setData: setDetail,
		setError,
	} = useFocusStoreLoad(
		useCallback(
			() => challenges.loadChallenge(enrolmentId),
			[challenges, enrolmentId],
		),
	);

	async function mutate(work: () => Promise<ChallengeDetail>) {
		setBusy(true);
		setError(null);
		try {
			setDetail(await work());
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	async function restart() {
		if (!detail) return;
		setBusy(true);
		setError(null);
		try {
			const enrolment = await challenges.startChallenge(detail.challengeSlug);
			router.replace(`/challenges/${enrolment.id}`);
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}
	if (!detail) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("detail.notFound")}
					body={error ?? t("detail.notFoundBody")}
					actionLabel={t("backToToday")}
					onAction={() => router.replace("/")}
					tone={error ? "danger" : undefined}
				/>
			</Screen>
		);
	}

	// Only a finished run has no next step, so this is non-null in exactly the
	// unfinished branch below. Hoisted so that branch narrows it for the callback.
	const nextDayIndex = detail.nextDayIndex;

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<AppText variant="display">{detail.title}</AppText>
			<AppText color="muted">
				{t("detail.progress", {
					started: detail.startedOn,
					done: detail.completedDayIndexes.length,
					total: detail.durationDays,
				})}
			</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}

			{detail.isFinished ? (
				<Card style={styles.card}>
					<AppText variant="section">{t("detail.finishedTitle")}</AppText>
					<AppText color="muted">
						{t("detail.finishedBody", {
							total: detail.durationDays,
							title: detail.title,
						})}
					</AppText>
					<Button
						label={t("backToToday")}
						onPress={() => router.replace("/")}
					/>
				</Card>
			) : null}

			{detail.abandonedAt !== null ? (
				<Card style={styles.card}>
					<AppText variant="section">{t("detail.endedTitle")}</AppText>
					<AppText color="muted">{t("detail.endedBody")}</AppText>
					<Button
						label={t("detail.startAgain")}
						loading={busy}
						onPress={() => void restart()}
					/>
				</Card>
			) : null}

			{!detail.isFinished &&
			detail.abandonedAt === null &&
			nextDayIndex !== null ? (
				<>
					<Card style={styles.card}>
						<AppText variant="caption" color="brand">
							{t("detail.dayOf", {
								day: nextDayIndex,
								total: detail.durationDays,
							})}
						</AppText>
						<AppText variant="section">
							{detail.currentDay?.title ??
								t("detail.dayTitle", { day: nextDayIndex })}
						</AppText>
						<AppText color="muted">
							{detail.currentDay?.action ?? t("detail.stepUnavailable")}
						</AppText>
						<Button
							label={t("detail.markStepDone")}
							loading={busy}
							onPress={() =>
								void mutate(() =>
									challenges.completeChallengeDay(
										detail.enrolmentId,
										nextDayIndex,
									),
								)
							}
						/>
					</Card>
					<View style={styles.abandon}>
						<AppText variant="caption" color="subtle">
							{t("detail.abandonNote")}
						</AppText>
						<Button
							label={t("detail.abandon")}
							variant="text"
							tone="danger"
							disabled={busy}
							onPress={() =>
								void mutate(() =>
									challenges.abandonChallenge(detail.enrolmentId),
								)
							}
						/>
					</View>
				</>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.lg },
	card: { gap: theme.spacing.md },
	abandon: { gap: theme.spacing.xs },
}));
