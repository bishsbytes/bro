import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { StackScreen as Screen } from "../../components/screen";
import {
	type ChallengeDetail,
	createHabitsStore,
	type HabitsStore,
} from "../../habits/habits-store";
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
	const challenges = useMemo(() => store ?? createHabitsStore(), [store]);
	const [detail, setDetail] = useState<ChallengeDetail | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setDetail(await challenges.loadChallenge(enrolmentId));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setLoaded(true);
		}
	}, [challenges, enrolmentId]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	async function mutate(work: () => Promise<ChallengeDetail>) {
		setBusy(true);
		setError(null);
		try {
			setDetail(await work());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
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
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	}

	if (!loaded && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}
	if (!detail) {
		return (
			<Screen centered padded>
				<EmptyState
					title="Challenge run not found"
					body={error ?? "This run is no longer available on this device."}
					actionLabel="Back to today"
					onAction={() => router.replace("/")}
					tone={error ? "danger" : undefined}
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<AppText variant="display">{detail.title}</AppText>
			<AppText color="muted">
				Started {detail.startedOn} · {detail.completedDayIndexes.length} of{" "}
				{detail.durationDays} steps complete
			</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}

			{detail.isFinished ? (
				<Card style={styles.card}>
					<AppText variant="section">You finished it</AppText>
					<AppText color="muted">
						You completed all {detail.durationDays} steps of {detail.title}.
					</AppText>
					<Button label="Back to today" onPress={() => router.replace("/")} />
				</Card>
			) : null}

			{detail.abandonedAt !== null ? (
				<Card style={styles.card}>
					<AppText variant="section">Challenge ended</AppText>
					<AppText color="muted">
						This run's history has been kept. You can start a fresh run whenever
						you are ready.
					</AppText>
					<Button
						label="Start again"
						loading={busy}
						onPress={() => void restart()}
					/>
				</Card>
			) : null}

			{!detail.isFinished && detail.abandonedAt === null ? (
				<>
					<Card style={styles.card}>
						<AppText variant="caption" color="brand">
							DAY {detail.nextDayIndex} OF {detail.durationDays}
						</AppText>
						<AppText variant="section">
							{detail.currentDay?.title ?? `Day ${detail.nextDayIndex}`}
						</AppText>
						<AppText color="muted">
							{detail.currentDay?.action ??
								"The authored step is unavailable in this version, but your run and progress are preserved."}
						</AppText>
						<Button
							label="Mark step done"
							loading={busy}
							disabled={detail.nextDayIndex === null}
							onPress={() => {
								const dayIndex = detail.nextDayIndex;
								if (dayIndex !== null) {
									void mutate(() =>
										challenges.completeChallengeDay(
											detail.enrolmentId,
											dayIndex,
										),
									);
								}
							}}
						/>
					</Card>
					<View style={styles.abandon}>
						<AppText variant="caption" color="subtle">
							Ending this run keeps every completed step in History.
						</AppText>
						<Button
							label="Abandon challenge"
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
