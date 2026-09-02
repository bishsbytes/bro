import { localDayOf, type MeasurementEntry } from "@bro/domain";
import { isTapeSiteSlug, TAPE_SITE_SLUGS } from "@bro/domain/metric-registry";
import { formatLocalDayLabelShort } from "@bro/logic";
import { router } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	type BodyMetricSummary,
	type BodyStore,
	createBodyStore,
	type MeasurementPresentation,
} from "../../body/body-store";
import { AppText } from "../../components/app-text";
import { BaselineGauge } from "../../components/baseline-gauge";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { MeasurementField } from "../../components/measurement-field";
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
	store?: Pick<BodyStore, "loadOverview" | "setTracked" | "recordMeasurement">;
};

type BodyText = TFunction<["body", "common"]>;

const WEIGHT_SLUG = "weight";

function gaugeValueParts(metric: BodyMetricSummary): {
	value: string;
	unit: string | null;
} {
	const formatted = metric.baseline.current?.formatted;
	const displayUnit = metric.displayUnit;
	if (!formatted || !displayUnit) return { value: formatted ?? "", unit: null };
	if (displayUnit === "%" && formatted.endsWith("%")) {
		return { value: formatted.slice(0, -1), unit: "%" };
	}
	const unitStart = formatted.indexOf(` ${displayUnit}`);
	if (unitStart < 0) return { value: formatted, unit: null };
	return {
		value: formatted.slice(0, unitStart),
		unit: formatted.slice(unitStart + 1),
	};
}

function dayLabel(
	localDay: string,
	todayLocalDay: string,
	locale: string | undefined,
): string {
	return formatLocalDayLabelShort(localDay, todayLocalDay, locale);
}

/** How and when the reading was taken — taped by hand, or brought in by a platform. */
function readingMeta(
	t: BodyText,
	metric: BodyMetricSummary,
	todayLocalDay: string,
	locale: string | undefined,
): string | null {
	const current = metric.baseline.current;
	if (!current) return null;
	const when = dayLabel(current.localDay, todayLocalDay, locale);
	const platform =
		metric.latest && metric.latest.source !== "user"
			? healthPlatformLabel(metric.latest.source)
			: null;
	if (platform) return t("body:reading.imported", { source: platform, when });
	if (isTapeSiteSlug(metric.metricSlug)) {
		return t("body:reading.taped", { when });
	}
	return t("body:reading.measured", { when });
}

/** The sentence naming the change since the reading before, with no verdict on it. */
function changeSentence(
	t: BodyText,
	metric: BodyMetricSummary,
	todayLocalDay: string,
	locale: string | undefined,
): string {
	const { current, previous, direction, changeFormatted } = metric.baseline;
	if (!current) return t("body:measurements.nothingLogged");
	if (!previous) return t("body:read.first");
	const when = dayLabel(previous.localDay, todayLocalDay, locale);
	if (direction === "none" || !changeFormatted) {
		return t("body:read.unchanged", { when });
	}
	return t(`body:read.${direction}`, { value: changeFormatted, when });
}

/** The gauge's one-line read: where this reading sits, then how far it moved. */
function readLine(
	t: BodyText,
	metric: BodyMetricSummary,
	todayLocalDay: string,
	locale: string | undefined,
): string | null {
	const { current, usualRange } = metric.baseline;
	if (!current) return null;
	const range = usualRange
		? t(
				current.value >= usualRange.min && current.value <= usualRange.max
					? "body:read.insideUsual"
					: "body:read.outsideUsual",
				{ min: usualRange.minFormatted, max: usualRange.maxFormatted },
			)
		: t("body:read.noRange");
	return t("body:read.joined", {
		range,
		change: changeSentence(t, metric, todayLocalDay, locale),
	});
}

function MetricGauge({
	metric,
	valueVariant,
	todayLocalDay,
	locale,
}: {
	metric: BodyMetricSummary;
	valueVariant: "metric" | "score";
	todayLocalDay: string;
	locale: string | undefined;
}) {
	const { t } = useTranslation(["body", "common"]);
	const { baseline } = metric;
	if (!baseline.current || !baseline.rail) {
		return (
			<AppText color="muted">{t("body:measurements.nothingLogged")}</AppText>
		);
	}
	const read = readLine(t, metric, todayLocalDay, locale);
	const displayed = gaugeValueParts(metric);

	return (
		<BaselineGauge
			label={metric.label}
			meta={readingMeta(t, metric, todayLocalDay, locale)}
			value={displayed.value}
			unit={displayed.unit}
			valueVariant={valueVariant}
			rail={baseline.rail}
			railLabels={{
				min: baseline.rail.minFormatted,
				max: baseline.rail.maxFormatted,
			}}
			band={baseline.usualRange}
			current={baseline.current.value}
			previous={baseline.previous?.value ?? null}
			read={read}
			accessibilityLabel={t("body:read.gaugeA11y", {
				name: metric.label,
				value: baseline.current.formatted,
				read: read ?? "",
			})}
		/>
	);
}

/**
 * Measurements, drawn the way a tailor takes them: tape sites on a neutral
 * pattern block, each read against the range that is usual for this user.
 *
 * There is deliberately no shape to compare — no radar, no polygon, no score.
 * A waist and a bicep have different units and opposite ideas of "up", so the
 * only honest comparison a measurement has is with its own history.
 */
export function BodyScreen({ store }: BodyScreenProps) {
	const { t } = useTranslation(["body", "common"]);
	const body = useMemo(() => store ?? createBodyStore(), [store]);
	const [busySlug, setBusySlug] = useState<string | null>(null);
	const [selection, setSelection] = useState<string | null>(null);
	const [editingSites, setEditingSites] = useState(false);
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
			if (enabled) setSelection(metricSlug);
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

	async function recordMeasurement(
		metricSlug: string,
		presentation: MeasurementPresentation,
	) {
		if (!overview || busySlug) return;
		const entry = entries[metricSlug] ?? EMPTY_ENTRY;
		if (isBlankEntry(entry)) return;
		const parsed = parseMeasurementInput(
			entry,
			presentation,
			overview.inputLocale,
		);
		if (!parsed.ok) {
			setEntryErrors((current) => ({ ...current, [metricSlug]: parsed.error }));
			return;
		}
		setBusySlug(metricSlug);
		setError(null);
		try {
			setOverview(
				await body.recordMeasurement(metricSlug, parsed.canonicalValue),
			);
			setEntries((current) => ({ ...current, [metricSlug]: EMPTY_ENTRY }));
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
	const visible = overview.metrics.filter((metric) => metric.visible);
	const weight = visible.find((metric) => metric.metricSlug === WEIGHT_SLUG);
	// Tape sites read down the body rather than by tracking order.
	const sites = TAPE_SITE_SLUGS.flatMap((slug) => {
		const metric = visible.find((candidate) => candidate.metricSlug === slug);
		return metric ? [metric] : [];
	});
	// Non-tape metrics can state their change, but only a tape-site row controls
	// the compact gauge above it. Body fat therefore remains list-only.
	const changeMetrics = [
		...sites,
		...visible.filter(
			(metric) =>
				metric.metricSlug !== WEIGHT_SLUG && !isTapeSiteSlug(metric.metricSlug),
		),
	];
	const selected =
		sites.find((metric) => metric.metricSlug === selection) ?? sites[0] ?? null;

	function changeCell(metric: BodyMetricSummary): string {
		const { current, previous, direction, changeFormatted } = metric.baseline;
		if (!current || !previous) return t("common:emDash");
		if (direction === "none" || !changeFormatted) return t("body:change.none");
		return t(`body:change.${direction}`, { value: changeFormatted });
	}

	// A site the user has added but not yet taped stays in the list: it is the
	// only place he can enter the first reading. An untracked site is absent.
	const changes: MeasurementChange[] = changeMetrics.map((metric) => ({
		slug: metric.metricSlug,
		label: metric.label,
		selectable: isTapeSiteSlug(metric.metricSlug),
		since: !metric.baseline.current
			? t("body:change.notLogged")
			: metric.baseline.previous
				? t("body:change.since", {
						when: dayLabel(
							metric.baseline.previous.localDay,
							todayLocalDay,
							locale,
						),
					})
				: t("body:change.first"),
		change: changeCell(metric),
		rail: metric.baseline.rail,
		band: metric.baseline.usualRange,
		current: metric.baseline.current?.value ?? null,
		previous: metric.baseline.previous?.value ?? null,
		accessibilityLabel: t("body:change.rowA11y", {
			name: metric.label,
			change: changeSentence(t, metric, todayLocalDay, locale),
		}),
	}));

	function entryFor(metric: BodyMetricSummary) {
		const presentation = metric.editablePresentation;
		if (!metric.tracked || !presentation) return null;
		return (
			<View style={styles.entry}>
				<MeasurementField
					label={metric.label}
					unit={presentation.displayUnit}
					entry={entries[metric.metricSlug] ?? EMPTY_ENTRY}
					onChangeEntry={(entry) => updateEntry(metric.metricSlug, entry)}
					placeholder={t("body:measurements.enterPlaceholder", {
						unit: presentation.displayUnit,
					})}
					error={entryErrors[metric.metricSlug]}
				/>
				<Button
					label={t("body:measurements.logMetric", { name: metric.label })}
					loading={busySlug === metric.metricSlug}
					disabled={busySlug !== null}
					onPress={() =>
						void recordMeasurement(metric.metricSlug, presentation)
					}
				/>
			</View>
		);
	}

	function openMetric(metric: BodyMetricSummary) {
		const navigate = () =>
			router.push({
				pathname: "/body/[slug]",
				params: { slug: metric.metricSlug },
			});
		return (
			<Button
				label={t("body:open", { name: metric.label })}
				variant="text"
				onPress={navigate}
			/>
		);
	}

	return (
		<Screen scroll padded gap="xl">
			<AppText color="muted">{t("body:overview.intro")}</AppText>

			{error ? <AppText color="danger">{error}</AppText> : null}

			{weight ? (
				<View style={styles.section}>
					<MetricGauge
						metric={weight}
						valueVariant="metric"
						todayLocalDay={todayLocalDay}
						locale={locale}
					/>
					{entryFor(weight)}
					{weight.activeGoal ? (
						<AppText variant="caption" color="muted">
							{t("body:goal.target", {
								value: weight.activeGoal.targetFormatted,
							})}
						</AppText>
					) : null}
					{openMetric(weight)}
				</View>
			) : null}

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

				{selected ? (
					<Card style={styles.panel}>
						<MetricGauge
							metric={selected}
							valueVariant={weight ? "score" : "metric"}
							todayLocalDay={todayLocalDay}
							locale={locale}
						/>
						{entryFor(selected)}
						{selected.activeGoal ? (
							<AppText variant="caption" color="muted">
								{t("body:goal.target", {
									value: selected.activeGoal.targetFormatted,
								})}
							</AppText>
						) : null}
						{openMetric(selected)}
					</Card>
				) : (
					<EmptyState
						title={t("body:measurements.emptyTitle")}
						body={t("body:measurements.emptyBody")}
						actionLabel={t("body:sites.manage")}
						onAction={() => setEditingSites(true)}
					/>
				)}

				{changes.length > 0 ? (
					<>
						<View style={styles.changeHeading}>
							<AppText variant="label">{t("body:change.title")}</AppText>
							<AppText variant="micro" color="subtle">
								{t("body:change.legend")}
							</AppText>
						</View>
						<MeasurementChangeList
							changes={changes}
							selectedSlug={selected?.metricSlug ?? null}
							onSelect={setSelection}
							onOpen={(metricSlug) =>
								router.push({
									pathname: "/body/[slug]",
									params: { slug: metricSlug },
								})
							}
						/>
					</>
				) : null}

				<Button
					label={t("body:measuring.link")}
					variant="text"
					onPress={() => router.push("/body/measuring")}
				/>
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
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	panel: { gap: theme.spacing.md },
	entry: { gap: theme.spacing.sm },
	changeHeading: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
}));

export default BodyScreen;
