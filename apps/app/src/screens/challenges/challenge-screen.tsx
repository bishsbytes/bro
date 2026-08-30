import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { StackScreen as Screen } from "../../components/screen";
import { resolveChallenge } from "../../content";
import { createHabitsStore, type HabitsStore } from "../../habits/habits-store";
import { toMessage } from "../../lib/errors";
import { StyleSheet } from "../../theme/unistyles";

export function ChallengeScreen({
	challengeSlug,
	store,
}: {
	challengeSlug: string;
	store?: Pick<HabitsStore, "startChallenge">;
}) {
	const { t } = useTranslation("challenges");
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
			setError(toMessage(caught));
		} finally {
			setStarting(false);
		}
	}

	if (!challenge) {
		return (
			<Screen padded centered>
				<EmptyState
					title={t("overview.notFound")}
					body={t("overview.notFoundBody")}
					actionLabel={t("overview.backToReviews")}
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
				{t("overview.summary", { total: challenge.durationDays })}
			</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label={t("overview.start")}
				loading={starting}
				onPress={() => void start()}
			/>

			{challenge.days.map((day) => (
				<Card key={day.day} style={styles.dayCard}>
					<AppText variant="caption" color="brand">
						{t("overview.day", { day: day.day })}
					</AppText>
					<AppText variant="section">{day.title}</AppText>
					<AppText color="muted">{day.action}</AppText>
				</Card>
			))}

			<Button
				label={t("overview.backToWheel")}
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
