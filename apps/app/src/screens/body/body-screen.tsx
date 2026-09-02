import { localDayOf, type MeasurementEntry } from "@bro/domain";
import { isTapeSiteSlug, TAPE_SITE_SLUGS } from "@bro/domain/metric-registry";
import { formatLocalDayLabelShort } from "@bro/logic";
import { router } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	type BodyMeasurementDraft,
	type BodyMetricSummary,
	type BodyStore,
	createBodyStore,
} from "../../body/body-store";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { MeasurementField } from "../../components/measurement-field";
import { ModalSheet } from "../../components/modal-sheet";
import { OptionSheet } from "../../components/option-sheet";
import { LoadingScreen, Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { healthPlatformLabel } from "../../health/platform-label";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	EMPTY_ENTRY,
	isBlankEntry,
	parseMeasurementInput,
} from "../../measurements/measurement-entry";
import { StyleSheet } from "../../theme/unistyles";
import {
	type MeasurementChange,
	MeasurementChangeList,
} from "./measurement-change-list";

type BodyScreenProps = {
	store?: Pick<BodyStore, "loadOverview" | "setTracked" | "recordMeasurements">;
};

type BodyText = TFunction<["body", "common"]>;

const WEIGHT_SLUG = "weight";
const RESTING_HEART_RATE_SLUG = "resting_heart_rate";

type LogMode =
	| "options"
	| typeof WEIGHT_SLUG
	| "measurements"
	| typeof RESTING_HEART_RATE_SLUG
	| null;

function changeSentence(
	t: BodyText,
	metric: BodyMetricSummary,
	todayLocalDay: string,
	locale: string | undefined,
): string {
	const { current, previous, direction, changeFormatted } = metric.baseline;
	if (!current) return t("body:measurements.nothingLogged");
	if (!previous) return t("body:read.first");
	const when = formatLocalDayLabelShort(
		previous.localDay,
		todayLocalDay,
		locale,
	);
	if (direction === "none" || !changeFormatted) {
		return t("body:read.unchanged", { when });
	}
	return t(`body:read.${direction}`, { value: changeFormatted, when });
}

export function BodyScreen({ store }: BodyScreenProps) {
	const { t } = useTranslation(["body", "common"]);
	const body = useMemo(() => store ?? createBodyStore(), [store]);
	const [busySlug, setBusySlug] = useState<string | null>(null);
	const [editingSites, setEditingSites] = useState(false);
	const [logMode, setLogMode] = useState<LogMode>(null);
	const [entries, setEntries] = useState<Record<string, MeasurementEntry>>({});
	const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});
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

	function updateEntry(metricSlug: string, entry: MeasurementEntry) {
		setEntries((current) => ({ ...current, [metricSlug]: entry }));
		setEntryErrors((current) => {
			if (!(metricSlug in current)) return current;
			const next = { ...current };
			delete next[metricSlug];
			return next;
		});
	}

	async function saveMeasurements(metrics: readonly BodyMetricSummary[]) {
		if (!overview || busySlug) return;
		const nextErrors: Record<string, string> = {};
		const drafts: BodyMeasurementDraft[] = [];
		for (const metric of metrics) {
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
		if (drafts.length === 0) {
			setLogMode(null);
			return;
		}
		setBusySlug("body-log");
		setError(null);
		try {
			setOverview(await body.recordMeasurements(drafts));
			setEntries((current) => {
				const next = { ...current };
				for (const draft of drafts) next[draft.metricSlug] = EMPTY_ENTRY;
				return next;
			});
			setLogMode(null);
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusySlug(null);
		}
	}

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
	const weight = metricBySlug.get(WEIGHT_SLUG) ?? null;
	const restingHeartRate = metricBySlug.get(RESTING_HEART_RATE_SLUG) ?? null;
	// Tape sites read down the body rather than by tracking order.
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
		const source = metric.latest
			? (healthPlatformLabel(metric.latest.source) ?? t("body:sourceYou"))
			: null;
		const since =
			current && source
				? t("body:change.meta", { source, comparison })
				: comparison;
		return {
			slug: metric.metricSlug,
			label: metric.label,
			since,
			change,
			rail: metric.baseline.rail,
			band: metric.baseline.usualRange,
			current: current?.value ?? null,
			previous: previous?.value ?? null,
			accessibilityLabel: t("body:change.rowA11y", {
				name: metric.label,
				change: changeSentence(t, metric, todayLocalDay, locale),
			}),
		};
	}
	const measurementChanges = measurementRows.map(changeOf);
	const heartChanges = restingHeartRate?.visible
		? [changeOf(restingHeartRate)]
		: [];

	const hasLogOptions =
		Boolean(weight?.tracked) ||
		sessionCore.length > 0 ||
		Boolean(restingHeartRate?.tracked);

	return (
		<Screen scroll padded gap="xl">
			<AppText color="muted">{t("body:overview.intro")}</AppText>
			<Button
				label={t("body:log.open")}
				disabled={busySlug !== null}
				onPress={() => {
					setError(null);
					setLogMode("options");
				}}
			/>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader
					title={t("body:measurements.title")}
					action={
						<Button
							label={t("body:sites.manage")}
							variant="text"
							disabled={busySlug !== null}
							onPress={() => setEditingSites(true)}
						/>
					}
				/>

				{measurementChanges.length > 0 ? (
					<Card testID="body-measurements-card" style={styles.listCard}>
						<View style={styles.changeHeading}>
							<AppText variant="label">{t("body:change.title")}</AppText>
							<AppText variant="micro" color="subtle">
								{t("body:change.legend")}
							</AppText>
						</View>
						<MeasurementChangeList
							changes={measurementChanges}
							onOpen={openMetric}
						/>
					</Card>
				) : (
					<EmptyState
						title={t("body:measurements.emptyTitle")}
						body={t("body:measurements.emptyBody")}
						actionLabel={t("body:sites.manage")}
						onAction={() => setEditingSites(true)}
					/>
				)}

				<Button
					label={t("body:measuring.link")}
					variant="text"
					onPress={() => router.push("/body/measuring")}
				/>
			</View>

			<View style={styles.section}>
				<SectionHeader title={t("body:heart.title")} />
				{heartChanges.length > 0 ? (
					<Card testID="body-heart-card" style={styles.listCard}>
						<View style={styles.changeHeading}>
							<AppText variant="label">{t("body:change.title")}</AppText>
							<AppText variant="micro" color="subtle">
								{t("body:change.legend")}
							</AppText>
						</View>
						<MeasurementChangeList changes={heartChanges} onOpen={openMetric} />
					</Card>
				) : (
					<EmptyState
						title={t("body:heart.emptyTitle")}
						body={t("body:heart.emptyBody")}
						actionLabel={t("body:sites.manage")}
						onAction={() => setEditingSites(true)}
					/>
				)}
			</View>

			{editingSites ? (
				<OptionSheet
					visible
					selection="multiple"
					title={t("body:sites.title")}
					intro={t("body:sites.intro")}
					closeAccessibilityLabel={t("body:sites.dismissA11y")}
					options={overview.metrics
						.filter((metric) => metric.userEnterable)
						.map((metric) => ({
							value: metric.metricSlug,
							label: metric.label,
							accessibilityLabel: metric.tracked
								? t("body:measurements.stopTracking", { name: metric.label })
								: t("body:measurements.track", { name: metric.label }),
						}))}
					selected={overview.metrics
						.filter((metric) => metric.tracked)
						.map((metric) => metric.metricSlug)}
					disabled={busySlug !== null}
					onSelect={(metricSlug) => {
						const metric = overview.metrics.find(
							(candidate) => candidate.metricSlug === metricSlug,
						);
						if (metric) void setTracked(metricSlug, !metric.tracked);
					}}
					onClose={() => setEditingSites(false)}
				/>
			) : null}

			<ModalSheet
				visible={logMode !== null}
				onClose={() => setLogMode(null)}
				closeAccessibilityLabel={t("body:log.dismissA11y")}
			>
				{logMode === "options" ? (
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
								actionLabel={t("body:sites.manage")}
								onAction={() => {
									setLogMode(null);
									setEditingSites(true);
								}}
							/>
						) : null}
					</View>
				) : logMetrics.length > 0 ? (
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
						{logMetrics.map((metric) => {
							const presentation = metric.editablePresentation;
							if (!presentation) return null;
							return (
								<MeasurementField
									key={metric.metricSlug}
									label={metric.label}
									unit={presentation.displayUnit}
									entry={entries[metric.metricSlug] ?? EMPTY_ENTRY}
									onChangeEntry={(entry) =>
										updateEntry(metric.metricSlug, entry)
									}
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
							onPress={() => void saveMeasurements(logMetrics)}
						/>
						<Button
							label={t("body:log.back")}
							variant="text"
							disabled={busySlug !== null}
							onPress={() => setLogMode("options")}
						/>
					</View>
				) : null}
			</ModalSheet>
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
