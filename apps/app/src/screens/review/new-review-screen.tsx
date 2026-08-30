import { router, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { ScoreRow } from "../../components/score-row";
import { LoadingScreen, FullScreen as Screen } from "../../components/screen";
import { WheelChart } from "../../components/wheel-chart";
import { playSelectionHaptic } from "../../feedback/selection-haptic";
import { toMessage } from "../../lib/errors";
import { useStoreLoad } from "../../lib/use-store-load";
import { lifeAreaIconName } from "../../review/life-area-icons";
import { formatScore } from "../../review/review-presentation";
import {
	createReviewStore,
	type ReviewStore,
	type WheelScore,
} from "../../review/review-store";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const MAX_FOCUS_AREAS = 3;

type NewReviewScreenProps = {
	store?: Pick<ReviewStore, "beginSitting" | "completeSitting">;
};

/**
 * Take stock asks for one life area at a time, the way the daily check-in asks
 * for one score at a time. Unlike the check-in it cannot write as it goes — a
 * wheel is only a wheel once every area carries a score — so nothing is saved
 * until the focus step, and leaving before that has to be deliberate.
 */
export function NewReviewScreen({ store }: NewReviewScreenProps) {
	const { t } = useTranslation("review");
	const { theme } = useUnistyles();
	const navigation = useNavigation();
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const [scores, setScores] = useState<Record<string, number>>({});
	const [focusItemSlugs, setFocusItemSlugs] = useState<string[]>([]);
	const [index, setIndex] = useState(0);
	const [confirmingExit, setConfirmingExit] = useState(false);
	const [saving, setSaving] = useState(false);
	const {
		data: draft,
		error,
		loading,
		setError,
	} = useStoreLoad(useCallback(() => reviews.beginSitting(), [reviews]));

	const steps = draft?.items ?? [];
	const answered = Object.keys(scores).length;

	// Set before any navigation this screen asks for, so the guard below lets
	// the deliberate exits — a discard, and the hop to the saved result — past.
	const leaving = useRef(false);

	// A swipe or hardware back would drop every score on the floor, so it does
	// what the screen's own Back does instead: steps back through the areas, and
	// only leaves from the first one — asking first when there is work to lose.
	useEffect(() => {
		return navigation.addListener("beforeRemove", (event) => {
			if (leaving.current || (index === 0 && answered === 0)) {
				return;
			}
			event.preventDefault();
			if (index === 0) {
				setConfirmingExit(true);
				return;
			}
			playSelectionHaptic();
			setError(null);
			setIndex((current) => current - 1);
		});
	}, [navigation, index, answered]);

	function leave() {
		leaving.current = true;
		router.back();
	}

	async function save() {
		if (!draft) {
			return;
		}
		playSelectionHaptic();
		setSaving(true);
		setError(null);
		try {
			const result = await reviews.completeSitting(
				draft,
				scores,
				focusItemSlugs,
			);
			leaving.current = true;
			router.replace({
				pathname: "/review/[id]",
				params: { id: result.assessment.id },
			});
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return <LoadingScreen variant="full" />;
	}

	if (!draft) {
		return (
			<Screen padded centered>
				<EmptyState title={t("sitting.startFailed")} body={error ?? ""} />
			</Screen>
		);
	}

	const complete = steps.every((item) => scores[item.slug] !== undefined);
	const wheelScores: WheelScore[] = steps.map((item) => ({
		...item,
		value: scores[item.slug] ?? 1,
		focused: focusItemSlugs.includes(item.slug),
	}));
	const previousWheelScores: WheelScore[] = steps.flatMap((item) => {
		const value = draft.previousScores[item.slug];
		return value === undefined ? [] : [{ ...item, value, focused: false }];
	});

	function answer(slug: string, value: number) {
		playSelectionHaptic();
		setError(null);
		setScores((current) => ({ ...current, [slug]: value }));
		setIndex((current) => current + 1);
	}

	function goTo(step: number) {
		playSelectionHaptic();
		setError(null);
		setIndex(step);
	}

	function toggleFocus(slug: string) {
		playSelectionHaptic();
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

	if (confirmingExit) {
		return (
			<Screen padded centered gap="lg">
				<View style={styles.prompt}>
					<AppText variant="display" style={styles.centredText}>
						{t("sitting.discardTitle")}
					</AppText>
					<AppText color="muted" style={styles.centredText}>
						{t("sitting.discardBody", { count: answered })}
					</AppText>
				</View>
				<Button
					label={t("sitting.keepGoing")}
					onPress={() => setConfirmingExit(false)}
				/>
				<Button
					label={t("sitting.discard")}
					variant="text"
					tone="danger"
					onPress={leave}
				/>
			</Screen>
		);
	}

	// Answering the last area lands here, which is the review's equivalent of the
	// check-in's confirmation: what was scored, and the one thing left to do.
	if (index >= steps.length) {
		return (
			<Screen padded>
				<ScrollView
					style={styles.focusScroll}
					contentContainerStyle={styles.focusContent}
				>
					<View style={styles.prompt}>
						<AppText variant="display" style={styles.centredText}>
							{t("sitting.focusTitle")}
						</AppText>
						<AppText color="muted" style={styles.centredText}>
							{t("sitting.focusIntro")}
						</AppText>
					</View>
					{wheelScores.length >= 3 ? (
						<WheelChart
							scores={wheelScores}
							previousScores={previousWheelScores}
						/>
					) : null}
					<AppText variant="caption" color="subtle">
						{t("sitting.focusCount", {
							selected: focusItemSlugs.length,
							max: MAX_FOCUS_AREAS,
						})}
					</AppText>
					{error ? <AppText color="danger">{error}</AppText> : null}
					{wheelScores.map((item, position) => {
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
									<Icon
										name={lifeAreaIconName(item.slug)}
										size={theme.control.focusIconSize}
										color={
											selected ? theme.colors.brand : theme.colors.textMuted
										}
									/>
									<AppText variant="label" style={styles.focusLabel}>
										{item.label}
									</AppText>
									{/* The score doubles as the way back to the area that set
									    it, so a correction is one tap rather than a walk back
									    through every area in between. */}
									<TouchableOpacity
										accessibilityRole="button"
										accessibilityLabel={t("sitting.changeAreaScore", {
											area: item.label,
										})}
										hitSlop={styles.scoreHitSlop}
										onPress={() => goTo(position)}
									>
										<AppText
											variant="score"
											color={selected ? "brand" : "muted"}
										>
											{t("scoreOutOf", { value: formatScore(item.value) })}
										</AppText>
									</TouchableOpacity>
								</Card>
							</TouchableOpacity>
						);
					})}
				</ScrollView>
				{/* The save stays put; eight areas of cards would otherwise push the
				    one action that matters below the fold. */}
				<View style={styles.footer}>
					<Button
						label={t("sitting.save")}
						loading={saving}
						onPress={() => void save()}
					/>
					<Button
						label={t("sitting.changeScores")}
						variant="secondary"
						disabled={saving}
						onPress={() => goTo(steps.length - 1)}
					/>
					<AppText variant="caption" color="subtle" style={styles.centredText}>
						{t("sitting.notSavedYet")}
					</AppText>
				</View>
			</Screen>
		);
	}

	const step = steps[index];
	const previous = draft.previousScores[step.slug];

	return (
		<Screen padded gap="lg">
			<View style={styles.topBar}>
				<View style={styles.navSide}>
					<TouchableOpacity
						accessibilityRole="button"
						accessibilityLabel={
							index === 0
								? t("sitting.nav.closeA11y")
								: t("sitting.nav.backA11y")
						}
						onPress={() =>
							index === 0
								? answered === 0
									? leave()
									: setConfirmingExit(true)
								: goTo(index - 1)
						}
					>
						<AppText variant="label" color="brand">
							{index === 0 ? t("sitting.nav.close") : t("sitting.nav.back")}
						</AppText>
					</TouchableOpacity>
				</View>
				<AppText variant="caption" color="subtle">
					{t("sitting.nav.position", {
						current: index + 1,
						total: steps.length,
					})}
				</AppText>
				{/* Only worth offering once every area carries a score, which means
				    after a walk back to change one. */}
				<View style={[styles.navSide, styles.navSideEnd]}>
					{complete ? (
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={t("sitting.chooseFocus")}
							onPress={() => goTo(steps.length)}
						>
							<AppText variant="label" color="brand">
								{t("sitting.nav.finish")}
							</AppText>
						</TouchableOpacity>
					) : null}
				</View>
			</View>

			<View style={styles.progress}>
				{steps.map((each, position) => (
					<View
						key={each.slug}
						style={[styles.pip, position <= index && styles.pipReached]}
					/>
				))}
			</View>

			<View style={styles.body}>
				<View style={styles.prompt}>
					<View style={styles.promptIcon}>
						<Icon
							name={lifeAreaIconName(step.slug)}
							size={theme.control.areaPromptIconSize}
							color={theme.colors.textMuted}
						/>
					</View>
					<AppText variant="display" style={styles.centredText}>
						{step.label}
					</AppText>
					<AppText color="muted" style={styles.centredText}>
						{t("sitting.scoreHint")}
					</AppText>
					{previous === undefined ? null : (
						<AppText
							variant="caption"
							color="subtle"
							style={styles.centredText}
						>
							{t("sitting.previousScore", {
								score: t("scoreOutOf", { value: formatScore(previous) }),
							})}
						</AppText>
					)}
				</View>
				<ScoreRow
					accessibilityPrefix={step.label}
					scores={SCORES}
					selected={scores[step.slug] ?? null}
					onSelect={(score) => answer(step.slug, score)}
				/>
			</View>

			{error ? <AppText color="danger">{error}</AppText> : null}
			<AppText variant="caption" color="subtle" style={styles.centredText}>
				{t("sitting.notSavedYet")}
			</AppText>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	topBar: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	/** Equal-width sides keep the step count centred whatever they hold. */
	navSide: { flex: 1, alignItems: "flex-start" },
	navSideEnd: { alignItems: "flex-end" },
	progress: {
		flexDirection: "row",
		justifyContent: "center",
		gap: theme.spacing.sm,
	},
	pip: {
		width: theme.spacing.sm,
		height: theme.spacing.sm,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.border,
	},
	pipReached: { backgroundColor: theme.colors.brand },
	/** The area sits centred in the space the list of cards used to fill. */
	body: { flex: 1, justifyContent: "center", gap: theme.spacing.xxl },
	prompt: { gap: theme.spacing.sm },
	focusScroll: { flex: 1 },
	focusContent: { gap: theme.spacing.lg, paddingBottom: theme.spacing.lg },
	footer: { gap: theme.spacing.sm },
	focusCard: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
		borderWidth: 1,
		borderColor: theme.colors.border,
	},
	focusLabel: { flex: 1 },
	promptIcon: { alignItems: "center" },
	focusSelected: {
		borderColor: theme.colors.brand,
		backgroundColor: theme.colors.selected,
	},
	scoreHitSlop: {
		top: theme.spacing.md,
		bottom: theme.spacing.md,
		left: theme.spacing.lg,
		right: theme.spacing.md,
	},
	centredText: { textAlign: "center" },
}));
