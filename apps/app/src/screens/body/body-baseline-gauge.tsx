import { localDayOf } from "@bro/domain";
import { isTapeSiteSlug } from "@bro/domain/metric-registry";
import { useTranslation } from "react-i18next";
import type { BodyMetricSummary } from "../../body/body-store";
import { BaselineGauge } from "../../components/baseline-gauge";
import { dataDomainForMetric } from "../../components/trend-chart";
import { healthPlatformLabel } from "../../health/platform-label";
import { type BodyText, changeSentence, dayLabel } from "./baseline-copy";

function gaugeValueParts(metric: BodyMetricSummary): {
	value: string;
	unit: string | null;
} {
	const formatted = metric.baseline.current?.formatted;
	const displayUnit = metric.displayUnit;
	if (!formatted) return { value: "", unit: null };
	if (metric.dimension === "rate_bpm" && formatted.endsWith(" bpm")) {
		return { value: formatted.slice(0, -4), unit: "bpm" };
	}
	if (!displayUnit) return { value: formatted, unit: null };
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

/** The gauge's one-line read: where this reading sits, then how far it moved. */
function readLine(
	t: BodyText,
	metric: BodyMetricSummary,
	todayLocalDay: string,
	locale: string | undefined,
): string {
	const { current, usualRange } = metric.baseline;
	if (!current) return t("body:measurements.nothingLogged");
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

export function BodyBaselineGauge({
	metric,
	locale,
	valueVariant = "score",
}: {
	metric: BodyMetricSummary;
	locale: string | undefined;
	valueVariant?: "metric" | "score";
}) {
	const { t } = useTranslation(["body", "common"]);
	const todayLocalDay = localDayOf(new Date());
	const { baseline } = metric;
	const displayed = gaugeValueParts(metric);
	const read = readLine(t, metric, todayLocalDay, locale);

	return (
		<BaselineGauge
			label={metric.label}
			meta={readingMeta(t, metric, todayLocalDay, locale)}
			value={baseline.current ? displayed.value : t("common:emDash")}
			unit={displayed.unit}
			valueVariant={valueVariant}
			rail={baseline.rail}
			railLabels={
				baseline.rail
					? {
							min: baseline.rail.minFormatted,
							max: baseline.rail.maxFormatted,
						}
					: null
			}
			band={baseline.usualRange}
			current={baseline.current?.value}
			previous={baseline.previous?.value ?? null}
			read={read}
			accessibilityLabel={t("body:read.gaugeA11y", {
				name: metric.label,
				value: baseline.current?.formatted ?? t("common:emDash"),
				read,
			})}
			domain={dataDomainForMetric(metric.metricSlug)}
		/>
	);
}
