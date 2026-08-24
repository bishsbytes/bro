import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { LoadingIndicator } from "../../components/loading-indicator";
import { ScoreRow } from "../../components/score-row";
import { FullScreen as Screen } from "../../components/screen";
import { playSelectionHaptic } from "../../feedback/selection-haptic";
import { StyleSheet } from "../../theme/unistyles";

type CheckInScreenProps = {
	store?: Pick<CheckInStore, "loadToday" | "saveCheckIn">;
	/** Mood already chosen on Today, so the flow opens on the next prompt. */
	initialMood?: number;
	/** Id of an existing check-in to rewrite rather than add to the day. */
	entryId?: string;
};

type CheckInStep = {
	slug: string;
	label: string;
	faces?: readonly string[];
	/** Shown under the scale so a 1 and a 5 mean the same thing every day. */
	hint: string;
};

const MOOD_STEP: CheckInStep = {
	slug: "mood",
	label: "Mood",
	faces: MOOD_FACES,
	hint: "How you feel right now, not how the day should have gone.",
};

const OPTIONAL_STEP_HINT = "1 is as low as it gets, 5 is as good as it gets.";

export function CheckInScreen({
	store,
	initialMood,
	entryId,
}: CheckInScreenProps) {
	const checkIns = useMemo(() => store ?? createCheckInStore(), [store]);
	const [today, setToday] = useState<TodayCheckIn | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [editing, setEditing] = useState<CheckInEntry | null>(null);
	const [values, setValues] = useState<Record<string, number>>(
		initialMood === undefined ? {} : { mood: initialMood },
	);
	// Mood is answered on Today when the flow is opened from a face, so the
	// first prompt the user sees here is the one they have not answered yet.
	const [index, setIndex] = useState(initialMood === undefined ? 0 : 1);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// `editing` is set once the first save lands so a revisit rewrites that
	// entry, which is not the same question as whether the flow was opened to
	// edit one — only the latter changes what the screen calls itself.
	const openedOnEntry = entryId !== undefined;

	const steps = useMemo<CheckInStep[]>(
		() =>
			today
				? [
						MOOD_STEP,
						...today.availableOptionalScores.map((metric) => ({
							slug: metric.slug,
							label: metric.label,
							hint: OPTIONAL_STEP_HINT,
						})),
					]
				: [],
		[today],
	);

	// The commit runs from an effect and from unmount, both of which see the
	// values as they were when they were captured — a ref keeps them current
	// without making the commit itself depend on every keystroke of state.
	const draft = useRef({
		values,
		editing,
		activeSlugs: [] as string[],
		knownEntryIds: new Set<string>(),
	});
	draft.current = {
		values,
		editing,
		activeSlugs: steps.map((step) => step.slug),
		knownEntryIds: new Set(today?.entries.map((entry) => entry.id) ?? []),
	};
	const committed = useRef(false);

	useEffect(() => {
		let active = true;
		void checkIns
			.loadToday()
			.then((loaded) => {
				if (!active) return;
				setToday(loaded);
				const entry = entryId
					? (loaded.entries.find((candidate) => candidate.id === entryId) ??
						null)
					: null;
				if (!entry) return;
				setEditing(entry);
				setValues({
					mood: entry.mood.value,
					...Object.fromEntries(
						entry.optionalScores.map((score) => [
							score.metricSlug,
							score.value,
						]),
					),
				});
			})
			.catch((caught: unknown) => {
				if (!active) return;
				setLoadError(caught instanceof Error ? caught.message : String(caught));
			});
		return () => {
			active = false;
		};
	}, [checkIns, entryId]);

	/**
	 * Writes the whole check-in in one transaction, exactly as the single-form
	 * version did — the flow spreads the prompts over cards, not the write over
	 * them, so a half-answered check-in is never a half-written one.
	 */
	const commit = useCallback(async () => {
		if (committed.current) return true;
		const {
			values: answered,
			editing: entry,
			activeSlugs,
			knownEntryIds,
		} = draft.current;
		const mood = answered.mood;
		if (mood === undefined) return true;
		committed.current = true;
		setSaving(true);
		setSaveError(null);
		try {
			const optional = Object.fromEntries(
				activeSlugs.flatMap((slug) =>
					slug === "mood" || answered[slug] === undefined
						? []
						: [[slug, answered[slug]]],
				),
			);
			const saved = await checkIns.saveCheckIn(
				{
					mood,
					...(Object.keys(optional).length > 0 ? { optional } : {}),
				},
				entry,
			);
			// A revisit from the confirmation must rewrite the entry this save
			// created rather than append a second one to the day.
			if (!entry) {
				const created = saved.entries.find(
					(candidate) => !knownEntryIds.has(candidate.id),
				);
				if (created) setEditing(created);
			}
			return true;
		} catch (caught) {
			committed.current = false;
			setSaveError(caught instanceof Error ? caught.message : String(caught));
			return false;
		} finally {
			setSaving(false);
		}
	}, [checkIns]);

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
		return (
			<Screen centered>
				<LoadingIndicator size="large" />
			</Screen>
		);
	}

	if (!today) {
		return (
			<Screen padded centered>
				<EmptyState
					title="The check-in could not be opened"
					body={loadError ?? ""}
				/>
				<Button
					label="Back"
					variant="secondary"
					onPress={() => router.back()}
				/>
			</Screen>
		);
	}

	const summary = checkInScoreSummary({
		mood: { value: values.mood ?? 0 },
		optionalScores: steps.flatMap((step) =>
			step.slug === "mood" || values[step.slug] === undefined
				? []
				: [{ metricSlug: step.slug, value: values[step.slug] }],
		),
	});

	if (done) {
		return (
			<Screen padded centered gap="lg">
				<View style={styles.prompt}>
					<AppText variant="display" style={styles.centredText}>
						{openedOnEntry ? "Check-in updated" : "Checked in"}
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
						label="Try again"
						loading={saving}
						onPress={() => void commit()}
					/>
				) : (
					<Button label="Done" loading={saving} onPress={() => router.back()} />
				)}
				<Button
					label="Change an answer"
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
					accessibilityLabel={index === 0 ? "Close check-in" : "Previous score"}
					onPress={goBack}
				>
					<AppText variant="label" color="brand">
						{index === 0 ? "Close" : "Back"}
					</AppText>
				</TouchableOpacity>
				<AppText variant="caption" color="subtle">
					{index + 1} of {steps.length}
				</AppText>
				<TouchableOpacity
					accessibilityRole="button"
					accessibilityLabel="Finish check-in"
					onPress={() => setIndex(steps.length)}
				>
					<AppText variant="label" color="brand">
						{openedOnEntry ? "Save" : "Finish"}
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
					<AppText variant="display" style={styles.centredText}>
						{step.label}
					</AppText>
					<AppText color="muted" style={styles.centredText}>
						{step.hint}
					</AppText>
				</View>
				<ScoreRow
					accessibilityPrefix={step.label}
					selected={values[step.slug] ?? null}
					onSelect={(score) => answer(step.slug, score)}
					faces={step.faces}
				/>
			</View>

			{saveError ? <AppText color="danger">{saveError}</AppText> : null}
			{step.slug === "mood" ? null : (
				<Button
					label={isLast ? "Skip and finish" : "Skip"}
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
