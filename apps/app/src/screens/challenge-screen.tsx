import { router } from "expo-router";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { Screen } from "../components/screen";
import { resolveChallenge } from "../content/challenge-catalogue";
import { StyleSheet } from "../theme/unistyles";

export function ChallengeScreen({ challengeSlug }: { challengeSlug: string }) {
	const challenge = resolveChallenge(challengeSlug);

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
				{challenge.durationDays}-day starter challenge · Follow it at your own
				pace
			</AppText>

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
