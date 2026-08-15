import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { Screen } from "../components/screen";
import {
	createReviewStore,
	type ReviewDraft,
	type ReviewStore,
} from "../review/review-store";
import { StyleSheet } from "../theme/unistyles";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type NewReviewScreenProps = {
	store?: Pick<ReviewStore, "beginSitting" | "completeSitting">;
};

export function NewReviewScreen({ store }: NewReviewScreenProps) {
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const [draft, setDraft] = useState<ReviewDraft | null>(null);
	const [scores, setScores] = useState<Record<string, number>>({});
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		let active = true;
		void reviews
			.beginSitting()
			.then((nextDraft) => {
				if (active) {
					setDraft(nextDraft);
				}
			})
			.catch((caught: unknown) => {
				if (active) {
					setError(caught instanceof Error ? caught.message : String(caught));
				}
			});
		return () => {
			active = false;
		};
	}, [reviews]);

	async function save() {
		if (!draft) {
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const result = await reviews.completeSitting(draft, scores);
			router.replace({
				pathname: "/review/[id]",
				params: { id: result.assessment.id },
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSaving(false);
		}
	}

	if (!draft && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	if (!draft) {
		return (
			<Screen padded centered>
				<EmptyState title="The wheel could not be started" body={error ?? ""} />
			</Screen>
		);
	}

	const complete = draft.items.every((item) => scores[item.slug] !== undefined);

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<AppText color="muted">
				How satisfied are you with each area today? Choose a whole number from 1
				to 10.
			</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}

			{draft.items.map((item) => (
				<Card key={item.slug} style={styles.areaCard}>
					<View style={styles.areaHeading}>
						<AppText variant="section">{item.label}</AppText>
						<AppText variant="score" color="brand">
							{scores[item.slug] ?? "—"}/10
						</AppText>
					</View>
					<View style={styles.scoreRow}>
						{SCORES.map((score) => (
							<TouchableOpacity
								key={score}
								accessibilityRole="button"
								accessibilityLabel={`${item.label} ${score}`}
								accessibilityState={{ selected: scores[item.slug] === score }}
								style={[
									styles.scoreButton,
									scores[item.slug] === score && styles.scoreSelected,
								]}
								onPress={() =>
									setScores((current) => ({
										...current,
										[item.slug]: score,
									}))
								}
							>
								<AppText variant="label">{score}</AppText>
							</TouchableOpacity>
						))}
					</View>
				</Card>
			))}

			<Button
				label="Save wheel"
				disabled={!complete}
				loading={saving}
				onPress={() => void save()}
			/>
			<AppText variant="caption" color="subtle" style={styles.footerCopy}>
				Nothing is saved until you finish.
			</AppText>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.lg },
	areaCard: { gap: theme.spacing.md },
	areaHeading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	scoreRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	scoreButton: {
		width: 44,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
		backgroundColor: theme.colors.background,
	},
	scoreSelected: {
		backgroundColor: theme.colors.selected,
		borderColor: theme.colors.brand,
	},
	footerCopy: { textAlign: "center" },
}));
