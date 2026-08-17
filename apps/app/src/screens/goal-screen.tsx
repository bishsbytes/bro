import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { FormField } from "../components/form-field";
import { StackScreen as Screen } from "../components/screen";
import {
	createReviewStore,
	type GoalSetup,
	type ReviewStore,
} from "../review/review-store";
import { StyleSheet } from "../theme/unistyles";

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
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const [setup, setSetup] = useState<GoalSetup | null | undefined>(undefined);
	const [target, setTarget] = useState("");
	const [targetDate, setTargetDate] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setSetup(undefined);
		setError(null);
		void reviews
			.loadGoalSetup(assessmentId, metricSlug)
			.then((nextSetup) => {
				setSetup(nextSetup);
				if (nextSetup) {
					setTarget(
						String(
							nextSetup.currentValue < 10 ? nextSetup.currentValue + 1 : 9,
						),
					);
				}
			})
			.catch((caught: unknown) => {
				setError(caught instanceof Error ? caught.message : String(caught));
			});
	}, [assessmentId, metricSlug, reviews]);

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
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSaving(false);
		}
	}

	if (setup === undefined && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	if (!setup) {
		return (
			<Screen padded centered>
				<EmptyState
					title="Focus area not found"
					body={error ?? "This area is not part of the saved review focus."}
					actionLabel="Back to reviews"
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
					Your current wheel score is {setup.currentValue}/10.
				</AppText>
			</Card>

			<FormField
				label="Target score"
				value={target}
				onChangeText={setTarget}
				keyboardType="number-pad"
				placeholder="1–10"
			/>
			<FormField
				label="Target date (optional)"
				value={targetDate}
				onChangeText={setTargetDate}
				autoCapitalize="none"
				placeholder="YYYY-MM-DD"
			/>
			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button label="Save goal" loading={saving} onPress={() => void save()} />
			<AppText variant="caption" color="subtle">
				Progress comes from future wheel scores; there is nothing extra to log.
			</AppText>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.lg },
	summary: { gap: theme.spacing.sm },
}));
