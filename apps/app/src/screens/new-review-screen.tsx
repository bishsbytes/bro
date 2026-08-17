import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { StackScreen as Screen } from "../components/screen";
import { WheelChart } from "../components/wheel-chart";
import {
	createReviewStore,
	type ReviewDraft,
	type ReviewStore,
	type WheelScore,
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
	const [focusItemSlugs, setFocusItemSlugs] = useState<string[]>([]);
	const [stage, setStage] = useState<"ratings" | "focus">("ratings");
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
			const result = await reviews.completeSitting(
				draft,
				scores,
				focusItemSlugs,
			);
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
	const wheelScores: WheelScore[] = draft.items.map((item) => ({
		...item,
		value: scores[item.slug] ?? 1,
		focused: focusItemSlugs.includes(item.slug),
	}));

	function toggleFocus(slug: string) {
		setError(null);
		if (focusItemSlugs.includes(slug)) {
			setFocusItemSlugs((current) =>
				current.filter((selected) => selected !== slug),
			);
			return;
		}
		if (focusItemSlugs.length === 3) {
			setError("Choose up to three focus areas.");
			return;
		}
		setFocusItemSlugs((current) => [...current, slug]);
	}

	if (stage === "focus") {
		return (
			<Screen scroll padded contentContainerStyle={styles.content}>
				<View style={styles.focusHeading}>
					<AppText variant="display">Choose your focus</AppText>
					<AppText color="muted">
						Pick up to three areas to work on next. You can also save without
						choosing one.
					</AppText>
				</View>
				{wheelScores.length >= 3 ? <WheelChart scores={wheelScores} /> : null}
				<AppText variant="caption" color="subtle">
					{focusItemSlugs.length}/3 selected
				</AppText>
				{error ? <AppText color="danger">{error}</AppText> : null}
				{wheelScores.map((item) => {
					const selected = focusItemSlugs.includes(item.slug);
					return (
						<TouchableOpacity
							key={item.slug}
							accessibilityRole="button"
							accessibilityLabel={`Focus on ${item.label}`}
							accessibilityState={{ selected }}
							onPress={() => toggleFocus(item.slug)}
						>
							<Card
								style={[styles.focusCard, selected && styles.focusSelected]}
							>
								<AppText variant="label">{item.label}</AppText>
								<AppText variant="score" color={selected ? "brand" : "muted"}>
									{item.value}/10
								</AppText>
							</Card>
						</TouchableOpacity>
					);
				})}
				<Button
					label="Save review"
					loading={saving}
					onPress={() => void save()}
				/>
				<Button
					label="Change scores"
					variant="secondary"
					onPress={() => {
						setError(null);
						setStage("ratings");
					}}
				/>
				<AppText variant="caption" color="subtle" style={styles.footerCopy}>
					Nothing is saved until you finish.
				</AppText>
			</Screen>
		);
	}

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
				label="Choose focus areas"
				disabled={!complete}
				onPress={() => {
					setError(null);
					setStage("focus");
				}}
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
	focusHeading: { gap: theme.spacing.sm },
	focusCard: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		borderWidth: 1,
		borderColor: theme.colors.border,
	},
	focusSelected: {
		borderColor: theme.colors.brand,
		backgroundColor: theme.colors.selected,
	},
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
