import {
	localDayOf,
	localTimeOf,
	type MeasurementEntry,
	resolveLocalMoment,
} from "@bro/domain";
import {
	type BodyMetricGroup,
	isTapeSiteSlug,
	TAPE_SITE_SLUGS,
} from "@bro/domain/metric-registry";
import { formatLocalDayLabelShort } from "@bro/logic";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
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
import { EmptyState } from "../../components/empty-state";
import { EventWhenFields } from "../../components/event-when-fields";
import { Icon } from "../../components/icon";
import { ListRow } from "../../components/list-row";
import { MeasurementField } from "../../components/measurement-field";
import { ModalSheet, SheetTextInput } from "../../components/modal-sheet";
import { LoadingScreen, Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { TextAction } from "../../components/text-action";
import { ThemedSwitch } from "../../components/themed-switch";
import { TrendChart } from "../../components/trend-chart";
import { healthPlatformLabel } from "../../health/platform-label";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	EMPTY_ENTRY,
	isBlankEntry,
	parseMeasurementInput,
} from "../../measurements/measurement-entry";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";
import { type BodyText, changeSentence } from "./baseline-copy";
import { BodyBaselineGauge, BodyRecentRange } from "./body-baseline-gauge";
import { BodyReadingSheet } from "./body-reading-sheet";

type MeasurementRow = {
	canAdd: boolean;
	comparison: string;
	slug: string;
	label: string;
	value: string;
	since: string | null;
	change: string;
	current: number | null;
	previous: number | null;
	accessibilityLabel: string;
};

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
	const [day, setDay] = useState(() => localDayOf(new Date()));
	const [time, setTime] = useState(() => localTimeOf(Date.now()));
	const [dateError, setDateError] = useState<string | null>(null);
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
		try {
			const moment = resolveLocalMoment({ localDay: day, time });
			setDateError(null);
			onSave(
				drafts.map((draft) => ({ ...draft, observedAt: moment.occurredAt })),
				onClose,
			);
		} catch {
			setDateError(t("body:log.invalidDate"));
		}
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
				<TextAction
					label={t("body:measuring.link")}
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
						inputComponent={SheetTextInput}
						editable={busySlug === null}
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
			<EventWhenFields
				localDay={day}
				time={time}
				today={localDayOf(new Date())}
				disabled={busySlug !== null}
				onChangeDay={setDay}
				onChangeTime={setTime}
			/>
			<AppText variant="caption" color="muted">
				{t("body:history.source", { source: t("body:reading.manual") })}
			</AppText>
			{dateError || error ? (
				<AppText color="danger">{dateError ?? error}</AppText>
			) : null}
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

function ChangeCard({
	testID,
	changes,
	onOpen,
	onAdd,
}: {
	testID: string;
	changes: readonly MeasurementRow[];
	onOpen: (slug: string) => void;
	onAdd: (slug: string) => void;
}) {
	const { theme } = useUnistyles();
	const { t } = useTranslation("body");
	return (
		<View testID={testID}>
			{changes.map((change, index) => (
				<View key={change.slug} style={styles.rowWithAction}>
					<ListRow
						layout="inline"
						variant="plain"
						density="compact"
						separator={index !== changes.length - 1}
						title={change.label}
						value={change.value}
						detail={
							change.current === null
								? undefined
								: change.previous === null
									? change.comparison
									: t("measurements.comparison", {
											change: change.change,
											when: change.comparison,
										})
						}
						accessibilityLabel={change.accessibilityLabel}
						onPress={() => onOpen(change.slug)}
						showChevron={change.current !== null || !change.canAdd}
						style={styles.measurementRow}
					/>
					{change.current === null && change.canAdd ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("measurements.addA11y", {
								name: change.label,
							})}
							style={styles.addAction}
							onPress={() => onAdd(change.slug)}
						>
							<Icon name="add" color={theme.colors.brand} size={20} />
						</Pressable>
					) : null}
				</View>
			))}
		</View>
	);
}

export function BodyScreen({ store }: BodyScreenProps) {
	const { t } = useTranslation(["body", "common"]);
	const body = useMemo(() => store ?? createBodyStore(), [store]);
	const [addingSlug, setAddingSlug] = useState<string | null>(null);
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

	function changeOf(metric: BodyMetricSummary): MeasurementRow {
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
				: t("body:measurements.recorded", {
						when: formatLocalDayLabelShort(
							current.localDay,
							todayLocalDay,
							locale,
						),
					});
		// Only an imported reading names its source here. "You" is the default a
		// man already assumes, and spending the row's second line on it pushed the
		// comparison date — the part that differs per site — out of the column.
		const platform =
			current && metric.latest && metric.latest.source !== "user"
				? healthPlatformLabel(metric.latest.source)
				: null;
		return {
			canAdd: Boolean(metric.tracked && metric.editablePresentation),
			comparison,
			value: current?.formatted ?? t("body:measurements.noReadings"),
			slug: metric.metricSlug,
			label: metric.label,
			since: platform
				? t("body:change.meta", { source: platform, comparison })
				: comparison,
			change,
			current: current?.value ?? null,
			previous: previous?.value ?? null,
			accessibilityLabel: t("body:change.rowA11y", {
				name: metric.label,
				change: changeSentence(t, metric, todayLocalDay, locale),
			}),
		};
	}
	const measurementChanges = measurementRows.map(changeOf);
	const heroMetric =
		overview.metrics.find(
			(metric) =>
				metric.metricSlug === WEIGHT_SLUG &&
				metric.visible &&
				metric.baseline.current,
		) ??
		overview.metrics.find(
			(metric) => metric.visible && metric.baseline.current,
		);
	const addingMetric = overview.metrics.find(
		(metric) => metric.metricSlug === addingSlug,
	);
	const healthFitnessChanges = overview.metrics
		.filter((metric) => metric.bodyGroup === "health_fitness" && metric.visible)
		.map(changeOf);

	return (
		<Screen
			scroll
			padded
			gap="lg"
			contentContainerStyle={styles.overviewContent}
		>
			<BodyLogSurfaceRegistration
				t={t}
				overview={overview}
				error={error}
				busySlug={busySlug}
				onSave={saveMeasurements}
				onManageMeasurements={openManageMeasurements}
			/>

			{heroMetric?.baseline.current ? (
				<Card style={styles.heroCard}>
					<BodyBaselineGauge
						metric={heroMetric}
						locale={locale}
						valueVariant="hero"
					/>
					{heroMetric.series.observedDayCount > 0 ? (
						<TrendChart
							compact
							height={156}
							showReadingsAction={false}
							series={heroMetric.series}
							label={heroMetric.label}
							displayUnit={heroMetric.displayUnit}
							usualRange={heroMetric.baseline.usualRange}
						/>
					) : null}
					<BodyRecentRange metric={heroMetric} />
				</Card>
			) : null}

			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader
					compact
					title={t("body:measurements.title")}
					action={
						measurementChanges.length > 0 ? (
							<TextAction
								chevron
								label={t("body:management.manage")}
								accessibilityLabel={t("body:management.measurementsAction")}
								disabled={busySlug !== null}
								onPress={openManageMeasurements}
							/>
						) : undefined
					}
				/>

				{measurementChanges.length > 0 ? (
					<ChangeCard
						testID="body-measurements-card"
						changes={measurementChanges}
						onOpen={openMetric}
						onAdd={(slug) => {
							const metric = overview.metrics.find(
								(item) => item.metricSlug === slug,
							);
							if (metric?.tracked && metric.editablePresentation)
								setAddingSlug(slug);
							else openMetric(slug);
						}}
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

			<AppText variant="footnote" color="muted">
				{t("body:overview.rangeNote")}
			</AppText>

			<View style={styles.section}>
				<SectionHeader
					compact
					title={t("body:healthFitness.title")}
					action={
						healthFitnessChanges.length > 0 ? (
							<TextAction
								chevron
								label={t("body:management.healthAction")}
								disabled={busySlug !== null}
								onPress={() => setEditingGroup("health_fitness")}
							/>
						) : undefined
					}
				/>
				{healthFitnessChanges.length > 0 ? (
					<ChangeCard
						testID="body-health-fitness-card"
						changes={healthFitnessChanges}
						onOpen={openMetric}
						onAdd={(slug) => {
							const metric = overview.metrics.find(
								(item) => item.metricSlug === slug,
							);
							if (metric?.tracked && metric.editablePresentation)
								setAddingSlug(slug);
							else openMetric(slug);
						}}
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

			{addingMetric ? (
				<BodyReadingSheet
					metric={addingMetric}
					locale={locale}
					busy={busySlug !== null}
					error={error}
					onClose={() => setAddingSlug(null)}
					onSave={(draft) =>
						void saveMeasurements([draft], () => setAddingSlug(null))
					}
				/>
			) : null}
			{editingGroup ? (
				<ModalSheet
					visible
					closeAccessibilityLabel={t(
						`body:management.${editingGroup}.dismissA11y`,
					)}
					onClose={() => {
						if (!busySlug) setEditingGroup(null);
					}}
				>
					<AppText variant="eyebrow">
						{t(`body:management.${editingGroup}.title`)}
					</AppText>
					<AppText variant="largeTitle">{t("body:management.title")}</AppText>
					<AppText color="muted">
						{t(`body:management.${editingGroup}.intro`)}
					</AppText>
					<View>
						{overview.metrics
							.filter((metric) => metric.bodyGroup === editingGroup)
							.map((metric) => (
								<View key={metric.metricSlug} style={styles.managementRow}>
									<AppText style={styles.managementLabel}>
										{metric.label}
									</AppText>
									<ThemedSwitch
										hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
										value={metric.tracked}
										disabled={busySlug !== null}
										accessibilityLabel={
											metric.userEnterable
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
														})
										}
										onValueChange={(enabled) =>
											void setTracked(metric.metricSlug, enabled)
										}
									/>
								</View>
							))}
					</View>
					{error ? <AppText color="danger">{error}</AppText> : null}
					<ListRow
						title={t("body:management.units")}
						onPress={() => {
							setEditingGroup(null);
							router.push("/settings/units");
						}}
					/>
					<Button
						label={t("common:datePicker.done")}
						disabled={busySlug !== null}
						onPress={() => setEditingGroup(null)}
					/>
				</ModalSheet>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: 0 },
	overviewContent: { paddingTop: 0, paddingBottom: theme.control.fabClearance },
	heroCard: {
		gap: theme.spacing.xs,
		flexShrink: 0,
	},
	rowWithAction: { flexDirection: "row", alignItems: "center" },
	addAction: {
		width: theme.control.minHitArea,
		minHeight: theme.control.minHitArea,
		alignItems: "center",
		justifyContent: "center",
	},
	measurementRow: { flex: 1 },
	managementRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
		minHeight: theme.control.buttonMinHeight,
		paddingVertical: theme.spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.line,
	},
	managementLabel: { flex: 1 },
	logSheet: { gap: theme.spacing.lg },
}));

export default BodyScreen;
