import { localDayOf, type MeasurementEntry } from "@bro/domain";
import {
	type BodyMetricGroup,
	isTapeSiteSlug,
	TAPE_SITE_SLUGS,
} from "@bro/domain/metric-registry";
import { formatLocalDayLabelShort } from "@bro/logic";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	type BodyLogSurfaceControls,
	useRegisterBodyLogSurface,
} from "../../body/body-log-surface-context";
import {
	type BodyMeasurementDraft,
	type BodyMetricSummary,
	type BodyOverview,
	type BodyStore,
	createBodyStore,
} from "../../body/body-store";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Dial } from "../../components/dial";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { MeasurementField } from "../../components/measurement-field";
import { OptionSheet } from "../../components/option-sheet";
import { LoadingScreen, Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { dataDomainForMetric } from "../../components/trend-chart";
import { healthPlatformLabel } from "../../health/platform-label";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	EMPTY_ENTRY,
	isBlankEntry,
	parseMeasurementInput,
} from "../../measurements/measurement-entry";
import { StyleSheet } from "../../theme/unistyles";
import { type BodyText, changeSentence } from "./baseline-copy";
import {
	hasPlottableRange,
	type MeasurementChange,
	MeasurementChangeList,
} from "./measurement-change-list";

type BodyScreenProps = {
	store?: Pick<BodyStore, "loadOverview" | "setTracked" | "recordMeasurements">;
};

const WEIGHT_SLUG = "weight";
const RESTING_HEART_RATE_SLUG = "resting_heart_rate";

type LogMode =
	| "options"
	| typeof WEIGHT_SLUG
	| "measurements"
	| typeof RESTING_HEART_RATE_SLUG;

type BodyLogContentProps = {
	t: BodyText;
	overview: BodyOverview;
	error: string | null;
	busySlug: string | null;
	onSave: (
		drafts: readonly BodyMeasurementDraft[],
		onSaved: () => void,
	) => void;
	onManageMeasurements: () => void;
	onBackToQuickLog: () => void;
	onClose: () => void;
};

/**
 * The body half of the quick-log sheet. It owns its own draft fields: the
 * overview behind it holds a gauge per metric, and re-rendering that on every
 * keystroke would be a lot of work to show one typed character.
 */
function BodyLogContent({
	t,
	overview,
	error,
	busySlug,
	onSave,
	onManageMeasurements,
	onBackToQuickLog,
	onClose,
}: BodyLogContentProps) {
	const [logMode, setLogMode] = useState<LogMode>("options");
	const [entries, setEntries] = useState<Record<string, MeasurementEntry>>({});
	const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});

	const metricBySlug = new Map(
		overview.metrics.map((metric) => [metric.metricSlug, metric]),
	);
	const weight = metricBySlug.get(WEIGHT_SLUG) ?? null;
	const restingHeartRate = metricBySlug.get(RESTING_HEART_RATE_SLUG) ?? null;
	const sites = TAPE_SITE_SLUGS.flatMap((slug) => {
		const metric = metricBySlug.get(slug);
		return metric?.visible ? [metric] : [];
	});
	const sessionCore = [
		...overview.metrics.filter(
			(metric) =>
				metric.bodyGroup === "measurements" &&
				metric.manualCapture === "measurement_session" &&
				!isTapeSiteSlug(metric.metricSlug) &&
				metric.tracked &&
				metric.editablePresentation !== null,
		),
		...sites.filter(
			(metric) =>
				metric.manualCapture === "measurement_session" &&
				metric.tracked &&
				metric.editablePresentation !== null,
		),
	];
	const sessionMetrics = [
		...(weight?.tracked && weight.editablePresentation ? [weight] : []),
		...sessionCore,
	];
	const logMetrics =
		logMode === "measurements"
			? sessionMetrics
			: logMode === WEIGHT_SLUG && weight?.tracked
				? [weight]
				: logMode === RESTING_HEART_RATE_SLUG && restingHeartRate?.tracked
					? [restingHeartRate]
					: [];
	const hasLogOptions =
		Boolean(weight?.tracked) ||
		sessionCore.length > 0 ||
		Boolean(restingHeartRate?.tracked);

	function updateEntry(metricSlug: string, entry: MeasurementEntry) {
		setEntries((current) => ({ ...current, [metricSlug]: entry }));
		setEntryErrors((current) => {
			if (!(metricSlug in current)) return current;
			const next = { ...current };
			delete next[metricSlug];
			return next;
		});
	}

	function save() {
		const nextErrors: Record<string, string> = {};
		const drafts: BodyMeasurementDraft[] = [];
		for (const metric of logMetrics) {
			const presentation = metric.editablePresentation;
			const entry = entries[metric.metricSlug] ?? EMPTY_ENTRY;
			if (!presentation || isBlankEntry(entry)) continue;
			const parsed = parseMeasurementInput(
				entry,
				presentation,
				overview.inputLocale,
			);
			if (!parsed.ok) {
				nextErrors[metric.metricSlug] = parsed.error;
				continue;
			}
			drafts.push({
				metricSlug: metric.metricSlug,
				canonicalValue: parsed.canonicalValue,
			});
		}
		setEntryErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;
		onSave(drafts, onClose);
	}

	if (logMode === "options") {
		return (
			<View style={styles.logSheet}>
				<AppText variant="section">{t("body:log.title")}</AppText>
				<AppText color="muted">{t("body:log.intro")}</AppText>
				{weight?.tracked ? (
					<ListRow
						title={t("body:log.weight")}
						detail={t("body:log.weightDetail")}
						accessibilityLabel={t("body:log.weight")}
						onPress={() => setLogMode(WEIGHT_SLUG)}
					/>
				) : null}
				{sessionCore.length > 0 ? (
					<ListRow
						title={t("body:log.session")}
						detail={t("body:log.sessionDetail")}
						accessibilityLabel={t("body:log.session")}
						onPress={() => setLogMode("measurements")}
					/>
				) : null}
				{restingHeartRate?.tracked ? (
					<ListRow
						title={t("body:log.heartRate")}
						detail={t("body:log.heartRateDetail")}
						accessibilityLabel={t("body:log.heartRate")}
						onPress={() => setLogMode(RESTING_HEART_RATE_SLUG)}
					/>
				) : null}
				{!hasLogOptions ? (
					<EmptyState
						title={t("body:log.emptyTitle")}
						body={t("body:log.emptyBody")}
						actionLabel={t("body:management.measurementsAction")}
						onAction={() => {
							onClose();
							onManageMeasurements();
						}}
					/>
				) : null}
				<Button
					label={t("body:log.backToQuickLog")}
					variant="text"
					disabled={busySlug !== null}
					onPress={onBackToQuickLog}
				/>
			</View>
		);
	}

	if (logMetrics.length === 0) return null;

	return (
		<View style={styles.logSheet}>
			<AppText variant="section">
				{logMode === "measurements"
					? t("body:log.session")
					: t("body:measurements.logMetric", {
							name: logMetrics[0]?.label,
						})}
			</AppText>
			<AppText color="muted">
				{logMode === "measurements"
					? t("body:log.sessionFormIntro")
					: t("body:log.singleFormIntro")}
			</AppText>
			{/* The guide belongs where the tape is about to go round, not on the
			    overview: this is the moment a man wants to know where the waist is. */}
			{logMode === "measurements" ? (
				<Button
					label={t("body:measuring.link")}
					variant="text"
					disabled={busySlug !== null}
					onPress={() => {
						onClose();
						router.push("/body/measuring");
					}}
				/>
			) : null}
			{logMetrics.map((metric) => {
				const presentation = metric.editablePresentation;
				if (!presentation) return null;
				return (
					<MeasurementField
						key={metric.metricSlug}
						label={metric.label}
						unit={presentation.displayUnit}
						entry={entries[metric.metricSlug] ?? EMPTY_ENTRY}
						onChangeEntry={(entry) => updateEntry(metric.metricSlug, entry)}
						placeholder={t("body:measurements.enterPlaceholder", {
							unit: presentation.displayUnit,
						})}
						error={entryErrors[metric.metricSlug]}
					/>
				);
			})}
			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label={
					logMode === "measurements"
						? t("body:log.saveSession")
						: t("body:log.saveReading")
				}
				loading={busySlug === "body-log"}
				disabled={busySlug !== null}
				onPress={save}
			/>
			<Button
				label={t("body:log.back")}
				variant="text"
				disabled={busySlug !== null}
				onPress={() => setLogMode("options")}
			/>
		</View>
	);
}

type BodyLogSurfaceRegistrationProps = Omit<
	BodyLogContentProps,
	"onBackToQuickLog" | "onClose"
>;

function BodyLogSurfaceRegistration({
	t,
	overview,
	error,
	busySlug,
	onSave,
	onManageMeasurements,
}: BodyLogSurfaceRegistrationProps) {
	const render = useCallback(
		({ close, backToQuickLog }: BodyLogSurfaceControls) => (
			<BodyLogContent
				t={t}
				overview={overview}
				error={error}
				busySlug={busySlug}
				onSave={onSave}
				onManageMeasurements={onManageMeasurements}
				onClose={close}
				onBackToQuickLog={backToQuickLog}
			/>
		),
		[busySlug, error, onManageMeasurements, onSave, overview, t],
	);
	const surface = useMemo(
		() => ({ closeAccessibilityLabel: t("body:log.dismissA11y"), render }),
		[render, t],
	);
	useRegisterBodyLogSurface(surface);
	return null;
}

/**
 * One group's rows under a shared column heading. The legend is passed rather
 * than repeated per card: it is a screen-wide convention, and stating it twice
 * makes two sibling groups read as two unrelated widgets.
 */
function ChangeCard({
	t,
	testID,
	changes,
	legend,
	onOpen,
}: {
	t: BodyText;
	testID: string;
	changes: readonly MeasurementChange[];
	legend: boolean;
	onOpen: (slug: string) => void;
}) {
	return (
		<Card testID={testID} style={styles.listCard}>
			<View style={styles.changeHeading}>
				<AppText variant="label">{t("body:change.title")}</AppText>
				{legend ? (
					<AppText variant="micro" color="subtle">
						{t("body:change.legend")}
					</AppText>
				) : null}
			</View>
			<MeasurementChangeList changes={changes} onOpen={onOpen} />
		</Card>
	);
}

export function BodyScreen({ store }: BodyScreenProps) {
	const { t } = useTranslation(["body", "common"]);
	const body = useMemo(() => store ?? createBodyStore(), [store]);
	const [busySlug, setBusySlug] = useState<string | null>(null);
	const [editingGroup, setEditingGroup] = useState<BodyMetricGroup | null>(
		null,
	);
	const openManageMeasurements = useCallback(
		() => setEditingGroup("measurements"),
		[],
	);
	const {
		data: overview,
		error,
		loading,
		reload,
		setData: setOverview,
		setError,
	} = useFocusStoreLoad(useCallback(() => body.loadOverview(), [body]));
	const todayLocalDay = localDayOf(new Date());

	async function setTracked(metricSlug: string, enabled: boolean) {
		setBusySlug(metricSlug);
		setError(null);
		try {
			setOverview(await body.setTracked(metricSlug, enabled));
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusySlug(null);
		}
	}

	const saveMeasurements = useCallback(
		async function saveMeasurements(
			drafts: readonly BodyMeasurementDraft[],
			onSaved: () => void,
		) {
			if (!overview || busySlug) return;
			if (drafts.length === 0) {
				onSaved();
				return;
			}
			setBusySlug("body-log");
			setError(null);
			try {
				setOverview(await body.recordMeasurements(drafts));
				onSaved();
			} catch (caught) {
				setError(toMessage(caught));
			} finally {
				setBusySlug(null);
			}
		},
		[body, busySlug, overview, setError, setOverview],
	);

	if (loading) {
		return <LoadingScreen variant="tab" />;
	}

	if (!overview) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("body:overview.loadFailed")}
					body={error ?? t("body:overview.loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const locale = overview.inputLocale;
	const metricBySlug = new Map(
		overview.metrics.map((metric) => [metric.metricSlug, metric]),
	);
	// Tape sites read down the body rather than by tracking order.
	const sites = TAPE_SITE_SLUGS.flatMap((slug) => {
		const metric = metricBySlug.get(slug);
		return metric?.visible ? [metric] : [];
	});
	const physicalRows = overview.metrics.filter(
		(metric) =>
			metric.bodyGroup === "measurements" &&
			!isTapeSiteSlug(metric.metricSlug) &&
			metric.visible,
	);
	const measurementRows = [...physicalRows, ...sites];

	function openMetric(metricSlug: string) {
		router.push({
			pathname: "/body/[slug]",
			params: { slug: metricSlug },
		});
	}

	function changeOf(metric: BodyMetricSummary): MeasurementChange {
		const { current, previous, direction, changeFormatted } = metric.baseline;
		const change =
			!current || !previous
				? t("common:emDash")
				: direction === "none" || !changeFormatted
					? t("body:change.none")
					: t(`body:change.${direction}`, { value: changeFormatted });
		const comparison = !current
			? t("body:change.notLogged")
			: previous
				? t("body:change.since", {
						when: formatLocalDayLabelShort(
							previous.localDay,
							todayLocalDay,
							locale,
						),
					})
				: t("body:change.first");
		// Only an imported reading names its source here. "You" is the default a
		// man already assumes, and spending the row's second line on it pushed the
		// comparison date — the part that differs per site — out of the column.
		const platform =
			current && metric.latest && metric.latest.source !== "user"
				? healthPlatformLabel(metric.latest.source)
				: null;
		return {
			slug: metric.metricSlug,
			label: metric.label,
			since: platform
				? t("body:change.meta", { source: platform, comparison })
				: comparison,
			change,
			rail: metric.baseline.rail,
			band: metric.baseline.usualRange,
			current: current?.value ?? null,
			previous: previous?.value ?? null,
			domain: dataDomainForMetric(metric.metricSlug),
			accessibilityLabel: t("body:change.rowA11y", {
				name: metric.label,
				change: changeSentence(t, metric, todayLocalDay, locale),
			}),
		};
	}
	const measurementChanges = measurementRows.map(changeOf);
	const heroMetric =
		overview.metrics.find(
			(metric) => metric.metricSlug === WEIGHT_SLUG && metric.baseline.current,
		) ??
		overview.metrics.find(
			(metric) => metric.visible && metric.baseline.current,
		);
	const healthFitnessChanges = overview.metrics
		.filter((metric) => metric.bodyGroup === "health_fitness" && metric.visible)
		.map(changeOf);
	// The legend describes marks, so it goes on the first card that draws any.
	const measurementsDrawMarks = measurementChanges.some(hasPlottableRange);
	const healthFitnessDrawsMarks = healthFitnessChanges.some(hasPlottableRange);
	const heroFormatted = heroMetric?.baseline.current?.formatted;
	const heroUnit =
		heroMetric?.displayUnit ??
		(heroMetric?.dimension === "rate_bpm" ? "bpm" : null);
	const heroUnitStart =
		heroFormatted && heroUnit
			? heroFormatted.indexOf(heroUnit === "%" ? heroUnit : ` ${heroUnit}`)
			: -1;
	const heroValue =
		heroFormatted && heroUnitStart >= 0
			? heroFormatted.slice(0, heroUnitStart)
			: heroFormatted;
	const heroValueUnit =
		heroFormatted && heroUnitStart >= 0
			? heroFormatted.slice(heroUnitStart + (heroUnit === "%" ? 0 : 1))
			: undefined;

	return (
		<Screen scroll padded gap="xl">
			<BodyLogSurfaceRegistration
				t={t}
				overview={overview}
				error={error}
				busySlug={busySlug}
				onSave={saveMeasurements}
				onManageMeasurements={openManageMeasurements}
			/>
			<AppText color="muted">{t("body:overview.intro")}</AppText>
			{heroMetric?.baseline.current && heroMetric.baseline.rail ? (
				<Dial
					label={heroMetric.label}
					value={heroValue ?? heroMetric.baseline.current.formatted}
					unit={heroValueUnit}
					current={heroMetric.baseline.current.value}
					range={heroMetric.baseline.rail}
					rangeLabels={{
						min: heroMetric.baseline.rail.minFormatted,
						max: heroMetric.baseline.rail.maxFormatted,
					}}
					usualRange={heroMetric.baseline.usualRange}
					domain={dataDomainForMetric(heroMetric.metricSlug)}
					accessibilityLabel={`${heroMetric.label}, ${heroMetric.baseline.current.formatted}`}
				/>
			) : null}

			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader
					title={t("body:measurements.title")}
					action={
						measurementChanges.length > 0 ? (
							<Button
								label={t("body:management.measurementsAction")}
								variant="text"
								disabled={busySlug !== null}
								onPress={openManageMeasurements}
							/>
						) : undefined
					}
				/>

				{measurementChanges.length > 0 ? (
					<ChangeCard
						t={t}
						testID="body-measurements-card"
						changes={measurementChanges}
						legend={measurementsDrawMarks}
						onOpen={openMetric}
					/>
				) : (
					<EmptyState
						title={t("body:measurements.emptyTitle")}
						body={t("body:measurements.emptyBody")}
						actionLabel={t("body:management.measurementsAction")}
						onAction={openManageMeasurements}
					/>
				)}
			</View>

			<View style={styles.section}>
				<SectionHeader
					title={t("body:healthFitness.title")}
					action={
						healthFitnessChanges.length > 0 ? (
							<Button
								label={t("body:management.healthAction")}
								variant="text"
								disabled={busySlug !== null}
								onPress={() => setEditingGroup("health_fitness")}
							/>
						) : undefined
					}
				/>
				{healthFitnessChanges.length > 0 ? (
					<ChangeCard
						t={t}
						testID="body-health-fitness-card"
						changes={healthFitnessChanges}
						legend={!measurementsDrawMarks && healthFitnessDrawsMarks}
						onOpen={openMetric}
					/>
				) : (
					<EmptyState
						title={t("body:healthFitness.emptyTitle")}
						body={t("body:healthFitness.emptyBody")}
						actionLabel={t("body:management.healthAction")}
						onAction={() => setEditingGroup("health_fitness")}
					/>
				)}
			</View>

			{editingGroup ? (
				<OptionSheet
					visible
					selection="multiple"
					title={t(`body:management.${editingGroup}.title`)}
					intro={t(`body:management.${editingGroup}.intro`)}
					closeAccessibilityLabel={t(
						`body:management.${editingGroup}.dismissA11y`,
					)}
					options={overview.metrics
						.filter((metric) => metric.bodyGroup === editingGroup)
						.map((metric) => ({
							value: metric.metricSlug,
							label: metric.label,
							accessibilityLabel: metric.userEnterable
								? metric.tracked
									? t("body:measurements.stopTracking", {
											name: metric.label,
										})
									: t("body:measurements.track", { name: metric.label })
								: metric.tracked
									? t("body:management.hideFromBody", {
											name: metric.label,
										})
									: t("body:management.showOnBody", {
											name: metric.label,
										}),
						}))}
					selected={overview.metrics
						.filter(
							(metric) => metric.bodyGroup === editingGroup && metric.tracked,
						)
						.map((metric) => metric.metricSlug)}
					disabled={busySlug !== null}
					onSelect={(metricSlug) => {
						const metric = overview.metrics.find(
							(candidate) => candidate.metricSlug === metricSlug,
						);
						if (metric) void setTracked(metricSlug, !metric.tracked);
					}}
					onClose={() => setEditingGroup(null)}
				/>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	listCard: {
		gap: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
	},
	changeHeading: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	logSheet: { gap: theme.spacing.lg },
}));

export default BodyScreen;
