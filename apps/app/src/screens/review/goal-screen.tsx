import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { toMessage } from "../../lib/errors";
import { useStoreLoad } from "../../lib/use-store-load";
import { createReviewStore, type ReviewStore } from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";

type GoalScreenProps = {
	assessmentId: string;
	metricSlug: string;
	store?: Pick<ReviewStore, "loadGoalSetup" | "createGoal">;
};

export function GoalScreen({
	assessmentId,
	metricSlug,
	store,
}: GoalScreenProps) {
	const { t } = useTranslation("review");
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const [target, setTarget] = useState("");
	const [targetDate, setTargetDate] = useState("");
	const [saving, setSaving] = useState(false);
	const {
		data: setup,
		error,
		loading,
		setError,
	} = useStoreLoad(
		useCallback(async () => {
			const next = await reviews.loadGoalSetup(assessmentId, metricSlug);
			// Open on the next point up, so the common case is one tap to save.
			if (next) {
				setTarget(String(next.currentValue < 10 ? next.currentValue + 1 : 9));
			}
			return next;
		}, [assessmentId, metricSlug, reviews]),
	);

	async function save() {
		if (!setup || saving) {
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await reviews.createGoal(
				assessmentId,
				metricSlug,
				Number(target),
				targetDate.trim() || null,
			);
			router.replace("/review");
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!setup) {
		return (
			<Screen padded centered>
				<EmptyState
					title={t("goal.notFound")}
					body={error ?? t("goal.notFoundBody")}
					actionLabel={t("backToReviews")}
					onAction={() => router.replace("/review")}
				/>
			</Screen>
		);
	}

	return (
		<Screen
			scroll
			padded
			keyboardShouldPersistTaps="handled"
			contentContainerStyle={styles.content}
		>
			<Card style={styles.summary}>
				<AppText variant="section">{setup.label}</AppText>
				<AppText color="muted">
					{t("goal.currentScore", {
						score: t("scoreOutOf", { value: setup.currentValue }),
					})}
				</AppText>
			</Card>

			<FormField
				label={t("goal.targetScore")}
				value={target}
				onChangeText={setTarget}
				keyboardType="number-pad"
				placeholder={t("goal.targetScorePlaceholder")}
			/>
			<FormField
				label={t("goal.targetDate")}
				value={targetDate}
				onChangeText={setTargetDate}
				autoCapitalize="none"
				placeholder={t("goal.targetDatePlaceholder")}
			/>
			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label={t("goal.save")}
				loading={saving}
				onPress={() => void save()}
			/>
			<AppText variant="caption" color="subtle">
				{t("goal.progressNote")}
			</AppText>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.lg },
	summary: { gap: theme.spacing.sm },
}));
