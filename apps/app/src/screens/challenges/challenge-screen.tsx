import { resolveChallenge } from "@bro/domain/challenge-catalogue";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { StackScreen as Screen } from "../../components/screen";
import { createHabitsStore, type HabitsStore } from "../../habits/habits-store";
import { StyleSheet } from "../../theme/unistyles";

export function ChallengeScreen({
	challengeSlug,
	store,
}: {
	challengeSlug: string;
	store?: Pick<HabitsStore, "startChallenge">;
}) {
	const challenge = resolveChallenge(challengeSlug);
	const challenges = useMemo(() => store ?? createHabitsStore(), [store]);
	const [starting, setStarting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function start() {
		if (!challenge || starting) return;
		setStarting(true);
		setError(null);
		try {
			const enrolment = await challenges.startChallenge(challenge.slug);
			router.replace(`/challenges/${enrolment.id}`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setStarting(false);
		}
	}

	if (!challenge) {
		return (
			<Screen padded centered>
				<EmptyState
					title="Challenge not found"
					body="This starter challenge is not available in this version of the app."
					actionLabel="Back to reviews"
					onAction={() => router.replace("/review")}
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<AppText variant="display">{challenge.title}</AppText>
			<AppText color="muted">{challenge.intro}</AppText>
			<AppText variant="caption" color="brand">
				{challenge.durationDays}-day challenge · Advance one completed step at a
				time
			</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label="Start this challenge"
				loading={starting}
				onPress={() => void start()}
			/>

			{challenge.days.map((day) => (
				<Card key={day.day} style={styles.dayCard}>
					<AppText variant="caption" color="brand">
						DAY {day.day}
					</AppText>
					<AppText variant="section">{day.title}</AppText>
					<AppText color="muted">{day.action}</AppText>
				</Card>
			))}

			<Button
				label="Back to my wheel"
				variant="secondary"
				onPress={() => router.back()}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.lg },
	dayCard: { gap: theme.spacing.sm },
}));
