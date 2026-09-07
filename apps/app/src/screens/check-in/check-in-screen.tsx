import { readCheckInDraft, writeCheckInDraft } from "@bro/database-app";
import type { CheckInSlot } from "@bro/domain/metric-registry";
import { router } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { checkInScoreSummary } from "../../check-in/check-in-presentation";
import {
	type CheckInEntry,
	type CheckInStore,
	createCheckInStore,
	type TodayCheckIn,
} from "../../check-in/check-in-store";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { EmptyState } from "../../components/empty-state";
import { ModalSheet } from "../../components/modal-sheet";
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
	labels?: readonly string[];
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
	const [done, setDone] = useState(false);
	const [partial, setPartial] = useState(false);
	const [dirty, setDirty] = useState(initialMood !== undefined);
	const [leaving, setLeaving] = useState(false);
	const [confirmClose, setConfirmClose] = useState(false);
	usePreventRemove(!leaving && dirty, () => setConfirmClose(true));
	useEffect(() => {
		if (leaving) router.back();
	}, [leaving]);

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
				labels: [
					t("mood.low"),
					t("mood.flat"),
					t("mood.okay"),
					t("mood.good"),
					t("mood.sharp"),
				],
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

	// Explicit saves read the latest draft, with a ref preventing repeated submissions.
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
				const sitting = loaded.sittings[slot];
				const entry = entryId && sitting?.id !== entryId ? null : sitting;
				try {
					const raw = readCheckInDraft(slot);
					const pending = raw ? JSON.parse(raw) : null;
					if (
						pending?.localDay === loaded.localDay &&
						pending.entryId === (entry?.id ?? null) &&
						pending.values &&
						typeof pending.values === "object"
					) {
						const restored = Object.fromEntries(
							Object.entries(pending.values).filter(
								(pair): pair is [string, number] =>
									typeof pair[1] === "number" &&
									Number.isInteger(pair[1]) &&
									pair[1] >= 1 &&
									pair[1] <= 5,
							),
						);
						setValues(restored);
						setIndex(
							Number.isInteger(pending.index)
								? Math.max(
										0,
										Math.min(
											pending.index,
											loaded.availableOptionalScores[slot].length,
										),
									)
								: 0,
						);
						setEditing(entry ?? null);
						setOpenedOnEntry(Boolean(entry));
						setDirty(Object.keys(restored).length > 0);
						return;
					}
				} catch {
					/* An unreadable draft does not prevent a new check-in. */
				}
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
		if (mood === undefined) return false;
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
			setDirty(false);
			setDone(true);
			try {
				writeCheckInDraft(slot, null);
			} catch {
				/* The record is already saved. */
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

	// A draft is device-local, separate from observations and exports.
	useEffect(() => {
		if (!today || !dirty || done) return;
		try {
			writeCheckInDraft(
				slot,
				JSON.stringify({
					localDay: today.localDay,
					entryId: editing?.id ?? null,
					values,
					index,
				}),
			);
		} catch (caught) {
			setSaveError(toMessage(caught));
		}
	}, [today, dirty, done, slot, editing, values, index]);

	function answer(slug: string, value: number) {
		playSelectionHaptic();
		committed.current = false;
		setDirty(true);
		setValues((current) => ({ ...current, [slug]: value }));
	}
	function close() {
		if (dirty) setConfirmClose(true);
		else setLeaving(true);
	}
	function goBack() {
		if (index === 0) close();
		else setIndex((current) => current - 1);
	}
	function leaveDraft(discard: boolean) {
		try {
			writeCheckInDraft(
				slot,
				discard
					? null
					: JSON.stringify({
							localDay: today?.localDay,
							entryId: editing?.id ?? null,
							values,
							index,
						}),
			);
			setLeaving(true);
		} catch (caught) {
			setSaveError(toMessage(caught));
		}
	}
	async function save() {
		setPartial(steps.some((step) => values[step.slug] === undefined));
		await commit();
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
					onPress={() => setLeaving(true)}
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
						{partial
							? t("confirmation.partial")
							: openedOnEntry
								? t("confirmation.updated")
								: t("confirmation.saved")}
					</AppText>
					<AppText variant="lead" color="muted" style={styles.centredText}>
						{summary}
					</AppText>
				</View>
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
						onPress={() => setLeaving(true)}
					/>
				)}
				<Button
					label={t("confirmation.changeAnswer")}
					variant="text"
					disabled={saving}
					onPress={() => {
						committed.current = false;
						setDone(false);
						setIndex(steps.length - 1);
					}}
				/>
			</Screen>
		);
	}

	const step = steps[index];
	const isLast = index === steps.length - 1;

	return (
		<Screen gap="lg">
			<View style={styles.topBar}>
				<TouchableOpacity
					accessibilityRole="button"
					accessibilityLabel={
						index === 0 ? t("nav.closeA11y") : t("nav.previousA11y")
					}
					style={styles.navButton}
					disabled={saving}
					onPress={goBack}
				>
					<AppText variant="label" color="brand">
						{index === 0 ? t("nav.close") : t("nav.back")}
					</AppText>
				</TouchableOpacity>
				<AppText variant="caption" color="subtle">
					{t("nav.position", { current: index + 1, total: steps.length })}
				</AppText>
				{index > 0 ? (
					<TouchableOpacity
						accessibilityRole="button"
						accessibilityLabel={t("nav.closeA11y")}
						style={styles.navButton}
						disabled={saving}
						onPress={close}
					>
						<AppText variant="label" color="brand">
							{t("nav.close")}
						</AppText>
					</TouchableOpacity>
				) : (
					<View style={styles.navButton} />
				)}
			</View>

			<View style={styles.progress}>
				{steps.map((each, position) => (
					<View
						key={each.slug}
						style={[styles.pip, position <= index && styles.pipReached]}
					/>
				))}
			</View>

			<ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
				<View style={styles.prompt}>
					{/* Which sitting is being answered, so the prompts are never
					    ambiguous about the half of the day they are asking about. */}
					<AppText variant="caption" color="subtle" style={styles.centredText}>
						{t(`slots.${slot}.name`)}
					</AppText>
					<AppText variant="display">
						{step.slug === MOOD_SLUG ? t("steps.moodQuestion") : step.label}
					</AppText>
					<AppText color="muted" style={styles.centredText}>
						{step.description}
					</AppText>
				</View>
				<ScoreRow
					accessibilityPrefix={step.label}
					selected={values[step.slug] ?? null}
					onSelect={(score) => answer(step.slug, score)}
					labels={step.labels}
					disabled={saving}
					endLabels={step.slug === MOOD_SLUG ? undefined : step.endLabels}
				/>
			</ScrollView>
			<View style={styles.footer}>
				{saveError ? (
					<AppText accessibilityRole="alert" color="danger">
						{saveError}
					</AppText>
				) : null}
				<Button
					label={isLast ? t("nav.saveCheckIn") : t("nav.continue")}
					loading={saving}
					disabled={values[step.slug] === undefined}
					onPress={() =>
						isLast ? void save() : setIndex((current) => current + 1)
					}
				/>
				<Button
					label={t("nav.saveForNow")}
					variant="secondary"
					disabled={saving || values.mood === undefined}
					onPress={() => void save()}
				/>
				{step.slug !== MOOD_SLUG && !isLast ? (
					<Button
						label={t("skip")}
						variant="text"
						disabled={saving}
						onPress={() => setIndex((current) => current + 1)}
					/>
				) : null}
			</View>
			<ModalSheet
				visible={confirmClose}
				onClose={() => setConfirmClose(false)}
				closeAccessibilityLabel={t("draft.continue")}
			>
				<AppText variant="title">{t("draft.title")}</AppText>
				<AppText color="muted">{t("draft.body")}</AppText>
				{saveError ? (
					<AppText accessibilityRole="alert" color="danger">
						{saveError}
					</AppText>
				) : null}
				<Button label={t("draft.keep")} onPress={() => leaveDraft(false)} />
				<Button
					label={t("draft.discard")}
					variant="text"
					tone="danger"
					onPress={() => leaveDraft(true)}
				/>
			</ModalSheet>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	topBar: {
		paddingHorizontal: theme.spacing.gutter,
		paddingTop: theme.spacing.sm,
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
	scroll: { flex: 1 },
	body: {
		paddingHorizontal: theme.spacing.gutter,
		paddingVertical: theme.spacing.lg,
		gap: theme.spacing.xl,
	},
	footer: {
		paddingHorizontal: theme.spacing.gutter,
		paddingBottom: theme.spacing.lg,
		gap: theme.spacing.sm,
	},
	navButton: {
		minHeight: theme.control.minHitArea,
		minWidth: theme.control.minHitArea,
		justifyContent: "center",
	},
	prompt: { gap: theme.spacing.sm },
	centredText: { textAlign: "left" },
}));
