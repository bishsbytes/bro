import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LoadingIndicator } from "../../components/loading-indicator";
import { StackScreen as Screen } from "../../components/screen";
import { WheelChart } from "../../components/wheel-chart";
import {
	createReviewStore,
	type ReviewDraft,
	type ReviewStore,
	type WheelScore,
} from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const MAX_FOCUS_AREAS = 3;

type NewReviewScreenProps = {
	store?: Pick<ReviewStore, "beginSitting" | "completeSitting">;
};

export function NewReviewScreen({ store }: NewReviewScreenProps) {
	const { t } = useTranslation("review");
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
				<LoadingIndicator size="large" />
			</Screen>
		);
	}

	if (!draft) {
		return (
			<Screen padded centered>
				<EmptyState title={t("sitting.startFailed")} body={error ?? ""} />
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
		if (focusItemSlugs.length === MAX_FOCUS_AREAS) {
			setError(t("sitting.focusLimit"));
			return;
		}
		setFocusItemSlugs((current) => [...current, slug]);
	}

	if (stage === "focus") {
		return (
			<Screen scroll padded contentContainerStyle={styles.content}>
				<View style={styles.focusHeading}>
					<AppText variant="display">{t("sitting.focusTitle")}</AppText>
					<AppText color="muted">{t("sitting.focusIntro")}</AppText>
				</View>
				{wheelScores.length >= 3 ? <WheelChart scores={wheelScores} /> : null}
				<AppText variant="caption" color="subtle">
					{t("sitting.focusCount", {
						selected: focusItemSlugs.length,
						max: MAX_FOCUS_AREAS,
					})}
				</AppText>
				{error ? <AppText color="danger">{error}</AppText> : null}
				{wheelScores.map((item) => {
					const selected = focusItemSlugs.includes(item.slug);
					return (
						<TouchableOpacity
							key={item.slug}
							accessibilityRole="button"
							accessibilityLabel={t("sitting.focusOn", { area: item.label })}
							accessibilityState={{ selected }}
							onPress={() => toggleFocus(item.slug)}
						>
							<Card
								style={[styles.focusCard, selected && styles.focusSelected]}
							>
								<AppText variant="label">{item.label}</AppText>
								<AppText variant="score" color={selected ? "brand" : "muted"}>
									{t("scoreOutOf", { value: item.value })}
								</AppText>
							</Card>
						</TouchableOpacity>
					);
				})}
				<Button
					label={t("sitting.save")}
					loading={saving}
					onPress={() => void save()}
				/>
				<Button
					label={t("sitting.changeScores")}
					variant="secondary"
					onPress={() => {
						setError(null);
						setStage("ratings");
					}}
				/>
				<AppText variant="caption" color="subtle" style={styles.footerCopy}>
					{t("sitting.notSavedYet")}
				</AppText>
			</Screen>
		);
	}

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<AppText color="muted">{t("sitting.ratingsIntro")}</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}

			{draft.items.map((item) => (
				<Card key={item.slug} style={styles.areaCard}>
					<View style={styles.areaHeading}>
						<AppText variant="section">{item.label}</AppText>
						<AppText variant="score" color="brand">
							{t("scoreOutOf", {
								value: scores[item.slug] ?? t("scoreUnset"),
							})}
						</AppText>
					</View>
					<View style={styles.scoreRow}>
						{SCORES.map((score) => (
							<TouchableOpacity
								key={score}
								accessibilityRole="button"
								accessibilityLabel={t("sitting.scoreArea", {
									area: item.label,
									score,
								})}
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
				label={t("sitting.chooseFocus")}
				disabled={!complete}
				onPress={() => {
					setError(null);
					setStage("focus");
				}}
			/>
			<AppText variant="caption" color="subtle" style={styles.footerCopy}>
				{t("sitting.notSavedYet")}
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
