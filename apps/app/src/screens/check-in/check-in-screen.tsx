import type { CheckInSlot } from "@bro/domain/metric-registry";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import {
	checkInScoreSummary,
	MOOD_FACES,
} from "../../check-in/check-in-presentation";
import {
	type CheckInEntry,
	type CheckInStore,
	createCheckInStore,
	type TodayCheckIn,
} from "../../check-in/check-in-store";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { EmptyState } from "../../components/empty-state";
import type { IconName } from "../../components/icon";
import { LoadingIndicator } from "../../components/loading-indicator";
import { ScoreRow } from "../../components/score-row";
import { LoadingScreen, FullScreen as Screen } from "../../components/screen";
import { playSelectionHaptic } from "../../feedback/selection-haptic";
import { toMessage } from "../../lib/errors";
import { StyleSheet } from "../../theme/unistyles";

type CheckInScreenProps = {
	store?: Pick<CheckInStore, "loadToday" | "saveCheckIn">;
	/** Which sitting is being answered. */
	slot: CheckInSlot;
	/** Mood already chosen in the journal, so the flow opens on the next prompt. */
	initialMood?: number;
	/** Id of an existing check-in to rewrite rather than add to the day. */
	entryId?: string;
};

type CheckInStep = {
	slug: string;
	label: string;
	faces?: readonly IconName[];
	description: string;
	endLabels: Readonly<{ minimum: string; maximum: string }>;
};

type OptionalRatingCopy = Pick<CheckInStep, "description" | "endLabels">;

const MOOD_SLUG = "mood";

export function CheckInScreen({
	store,
	slot,
	initialMood,
	entryId,
}: CheckInScreenProps) {
	const { t } = useTranslation(["checkIn", "common"]);
	const checkIns = useMemo(() => store ?? createCheckInStore(), [store]);
	const [today, setToday] = useState<TodayCheckIn | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [editing, setEditing] = useState<CheckInEntry | null>(null);
	const [values, setValues] = useState<Record<string, number>>(
		initialMood === undefined ? {} : { mood: initialMood },
	);
	// Mood is answered in the journal when the flow is opened from a face, so the
	// first prompt the user sees here is the one they have not answered yet.
	const [index, setIndex] = useState(initialMood === undefined ? 0 : 1);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// `editing` is set once the first save lands so a revisit rewrites that
	// entry, which is not the same question as whether the flow opened onto one
	// that already existed — only the latter changes what the screen calls
	// itself, and a filled sitting counts whether or not it was named in the URL.
	const [openedOnEntry, setOpenedOnEntry] = useState(false);

	const steps = useMemo<CheckInStep[]>(() => {
		if (!today) return [];
		const fallback: OptionalRatingCopy = {
			description: t("steps.ratings.fallbackDescription"),
			endLabels: {
				minimum: t("common:ratingEnds.veryLow"),
				maximum: t("common:ratingEnds.veryGood"),
			},
		};
		const optionalCopy: Record<string, OptionalRatingCopy> = {
			energy: {
				description: t("steps.ratings.energy.description"),
				endLabels: {
					minimum: t("steps.ratings.energy.minimum"),
					maximum: t("steps.ratings.energy.maximum"),
				},
			},
			motivation: {
				description: t("steps.ratings.motivation.description"),
				endLabels: {
					minimum: t("steps.ratings.motivation.minimum"),
					maximum: t("steps.ratings.motivation.maximum"),
				},
			},
			productivity: {
				description: t("steps.ratings.productivity.description"),
				endLabels: {
					minimum: t("steps.ratings.productivity.minimum"),
					maximum: t("steps.ratings.productivity.maximum"),
				},
			},
			libido: {
				description: t("steps.ratings.libido.description"),
				endLabels: {
					minimum: t("steps.ratings.libido.minimum"),
					maximum: t("steps.ratings.libido.maximum"),
				},
			},
		};

		return [
			{
				slug: MOOD_SLUG,
				label: t("steps.moodLabel"),
				faces: MOOD_FACES,
				description: t(`slots.${slot}.moodHint`),
				endLabels: {
					minimum: t("common:ratingEnds.veryBad"),
					maximum: t("common:ratingEnds.veryGood"),
				},
			},
			...today.availableOptionalScores[slot].map((metric) => ({
				slug: metric.slug,
				label: metric.label,
				...(optionalCopy[metric.slug] ?? fallback),
			})),
		];
	}, [today, t, slot]);

	// The commit runs from an effect and from unmount, both of which see the
	// values as they were when they were captured — a ref keeps them current
	// without making the commit itself depend on every keystroke of state.
	const draft = useRef({
		values,
		editing,
		activeSlugs: [] as string[],
	});
	draft.current = {
		values,
		editing,
		activeSlugs: steps.map((step) => step.slug),
	};
	const committed = useRef(false);

	useEffect(() => {
		let active = true;
		void checkIns
			.loadToday()
			.then((loaded) => {
				if (!active) return;
				setToday(loaded);
				// A specific id is only valid inside the sitting named by the route.
				// Legacy slotless entries use the history editor, where they cannot be
				// mistaken for whichever sitting the current clock happens to suggest.
				const sitting = loaded.sittings[slot];
				const entry = entryId && sitting?.id !== entryId ? null : sitting;
				if (!entry) return;
				setEditing(entry);
				setOpenedOnEntry(true);
				setValues((current) => ({
					mood: entry.mood.value,
					...Object.fromEntries(
						entry.optionalScores.map((score) => [
							score.metricSlug,
							score.value,
						]),
					),
					// A mood tapped on the way in is the answer being changed.
					...current,
				}));
			})
			.catch((caught: unknown) => {
				if (!active) return;
				setLoadError(toMessage(caught));
			});
		return () => {
			active = false;
		};
	}, [checkIns, entryId, slot]);

	/**
	 * Writes the whole check-in in one transaction, exactly as the single-form
	 * version did — the flow spreads the prompts over cards, not the write over
	 * them, so a half-answered check-in is never a half-written one.
	 */
	const commit = useCallback(async () => {
		if (committed.current) return true;
		const { values: answered, editing: entry, activeSlugs } = draft.current;
		const mood = answered.mood;
		if (mood === undefined) return true;
		committed.current = true;
		setSaving(true);
		setSaveError(null);
		try {
			const optional = Object.fromEntries(
				activeSlugs.flatMap((slug) =>
					slug === MOOD_SLUG || answered[slug] === undefined
						? []
						: [[slug, answered[slug]]],
				),
			);
			const saved = await checkIns.saveCheckIn(
				slot,
				{
					mood,
					...(Object.keys(optional).length > 0 ? { optional } : {}),
				},
				entry,
			);
			// A revisit from the confirmation rewrites the sitting this save just
			// filled. The store would find it by slot anyway; holding it here keeps
			// the screen's own edit path explicit.
			if (!entry) {
				setEditing(saved.sittings[slot]);
			}
			return true;
		} catch (caught) {
			committed.current = false;
			setSaveError(toMessage(caught));
			return false;
		} finally {
			setSaving(false);
		}
	}, [checkIns, slot]);

	const done = index >= steps.length && steps.length > 0;

	// Reaching the end of the prompts is the save; there is no save button to
	// forget to press.
	useEffect(() => {
		if (done) void commit();
	}, [done, commit]);

	// Leaving early still keeps what was answered. The explicit paths above
	// report their own failures; this one is the net under a swipe back.
	useEffect(
		() => () => {
			void commit();
		},
		[commit],
	);

	function answer(slug: string, value: number) {
		playSelectionHaptic();
		setValues((current) => ({ ...current, [slug]: value }));
		setIndex((current) => current + 1);
	}

	function goBack() {
		if (index === 0) {
			void close();
			return;
		}
		playSelectionHaptic();
		setIndex((current) => current - 1);
	}

	async function close() {
		if (await commit()) router.back();
	}

	if (!today && !loadError) {
		return <LoadingScreen variant="full" />;
	}

	if (!today) {
		return (
			<Screen padded centered>
				<EmptyState title={t("loadFailed")} body={loadError ?? ""} />
				<Button
					label={t("nav.back")}
					variant="secondary"
					onPress={() => router.back()}
				/>
			</Screen>
		);
	}

	const summary = checkInScoreSummary({
		mood: { value: values.mood ?? 0 },
		optionalScores: steps.flatMap((step) =>
			step.slug === MOOD_SLUG || values[step.slug] === undefined
				? []
				: [{ metricSlug: step.slug, value: values[step.slug] }],
		),
	});

	if (done) {
		return (
			<Screen padded centered gap="lg">
				<View style={styles.prompt}>
					<AppText variant="display" style={styles.centredText}>
						{openedOnEntry
							? t("confirmation.updated")
							: t("confirmation.saved")}
					</AppText>
					<AppText color="muted" style={styles.centredText}>
						{summary}
					</AppText>
				</View>
				{saving ? <LoadingIndicator /> : null}
				{saveError ? (
					<AppText color="danger" style={styles.centredText}>
						{saveError}
					</AppText>
				) : null}
				{saveError ? (
					<Button
						label={t("common:actions.tryAgain")}
						loading={saving}
						onPress={() => void commit()}
					/>
				) : (
					<Button
						label={t("confirmation.done")}
						loading={saving}
						onPress={() => router.back()}
					/>
				)}
				<Button
					label={t("confirmation.changeAnswer")}
					variant="text"
					disabled={saving}
					onPress={() => {
						committed.current = false;
						setIndex(steps.length - 1);
					}}
				/>
			</Screen>
		);
	}

	const step = steps[index];
	const isLast = index === steps.length - 1;

	return (
		<Screen padded gap="lg">
			<View style={styles.topBar}>
				<TouchableOpacity
					accessibilityRole="button"
					accessibilityLabel={
						index === 0 ? t("nav.closeA11y") : t("nav.previousA11y")
					}
					onPress={goBack}
				>
					<AppText variant="label" color="brand">
						{index === 0 ? t("nav.close") : t("nav.back")}
					</AppText>
				</TouchableOpacity>
				<AppText variant="caption" color="subtle">
					{t("nav.position", { current: index + 1, total: steps.length })}
				</AppText>
				<TouchableOpacity
					accessibilityRole="button"
					accessibilityLabel={t("nav.finishA11y")}
					onPress={() => setIndex(steps.length)}
				>
					<AppText variant="label" color="brand">
						{openedOnEntry ? t("nav.save") : t("nav.finish")}
					</AppText>
				</TouchableOpacity>
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
					{/* Which sitting is being answered, so the prompts are never
					    ambiguous about the half of the day they are asking about. */}
					<AppText variant="caption" color="subtle" style={styles.centredText}>
						{t(`slots.${slot}.name`)}
					</AppText>
					<AppText variant="display" style={styles.centredText}>
						{step.label}
					</AppText>
					<AppText color="muted" style={styles.centredText}>
						{step.description}
					</AppText>
				</View>
				<ScoreRow
					accessibilityPrefix={step.label}
					selected={values[step.slug] ?? null}
					onSelect={(score) => answer(step.slug, score)}
					faces={step.faces}
					endLabels={step.endLabels}
				/>
			</View>

			{saveError ? <AppText color="danger">{saveError}</AppText> : null}
			{step.slug === MOOD_SLUG ? null : (
				<Button
					label={isLast ? t("skipAndFinish") : t("skip")}
					variant="text"
					onPress={() => setIndex((current) => current + 1)}
				/>
			)}
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
	/** The prompt sits centred in the space the feed used to push around. */
	body: { flex: 1, justifyContent: "center", gap: theme.spacing.xxl },
	prompt: { gap: theme.spacing.sm },
	centredText: { textAlign: "center" },
}));
