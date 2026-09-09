import { localDayOf } from "@bro/domain";
import { MEASUREMENT_BASELINE_WINDOW_DAYS, type TrendPoint } from "@bro/logic";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import type { BodyMetricSummary } from "../../body/body-store";
import { AppText } from "../../components/app-text";
import { ModalSheet } from "../../components/modal-sheet";
import { SourceStamp } from "../../components/source-stamp";
import { StyleSheet } from "../../theme/unistyles";
import { changeSentence } from "./baseline-copy";

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

/** Shared editorial readout for the overview card and measurement detail. */
export function BodyBaselineGauge({
	metric,
	locale,
	valueVariant = "list",
	explored,
	showLabel = true,
}: {
	metric: BodyMetricSummary;
	locale: string | undefined;
	valueVariant?: "hero" | "list";
	explored?: { point: TrendPoint; formatted: string } | null;
	showLabel?: boolean;
}) {
	const { t } = useTranslation(["body", "common"]);
	const { baseline } = metric;
	const displayed = gaugeValueParts(metric);
	return (
		<View testID="measurement-readout" style={styles.summary}>
			{showLabel ? <AppText variant="label">{metric.label}</AppText> : null}
			<AppText
				variant={valueVariant === "hero" ? "monoHero" : "monoReadout"}
				style={styles.value}
				accessibilityLabel={t("body:read.gaugeA11y", {
					name: metric.label,
					value:
						explored?.formatted ??
						baseline.current?.formatted ??
						t("common:emDash"),
					read:
						explored?.point.localDay ??
						changeSentence(t, metric, localDayOf(new Date()), locale),
				})}
			>
				{explored?.formatted ??
					(baseline.current ? displayed.value : t("common:emDash"))}
				{!explored && displayed.unit ? (
					<AppText variant="body">{` ${displayed.unit}`}</AppText>
				) : null}
			</AppText>
			{explored ? (
				<AppText variant="caption" color="muted">
					{explored.point.localDay}
				</AppText>
			) : baseline.current ? (
				<SourceStamp
					source={metric.latest?.source ?? "user"}
					observedAt={baseline.current.observedAt}
					localDay={baseline.current.localDay}
					locale={locale}
				/>
			) : (
				<AppText color="muted">{t("body:measurements.nothingLogged")}</AppText>
			)}
		</View>
	);
}

export function BodyRecentRange({ metric }: { metric: BodyMetricSummary }) {
	const { t } = useTranslation(["body", "common"]);
	const [expanded, setExpanded] = useState(false);
	const range = metric.baseline.usualRange;
	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("body:read.aboutRange")}
				onPress={() => setExpanded(true)}
				style={styles.range}
			>
				{range ? <View style={styles.swatch} /> : null}
				<View style={styles.rangeCopy}>
					<AppText variant="footnote" color="muted">
						{range ? t("body:read.rangeTitle") : t("body:read.noRange")}
					</AppText>
					{range ? (
						<AppText variant="footnote" color="muted">
							{t("body:read.rangeBasis")}
						</AppText>
					) : null}
				</View>
			</Pressable>
			<ModalSheet
				visible={expanded}
				onClose={() => setExpanded(false)}
				closeAccessibilityLabel={t("common:actions.close")}
			>
				<AppText variant="title">{t("body:read.rangeTitle")}</AppText>
				{range ? (
					<AppText>
						{t("body:read.range", {
							min: range.minFormatted,
							max: range.maxFormatted,
						})}
					</AppText>
				) : null}
				<AppText color="muted">
					{t("body:read.method", {
						count: metric.baseline.readingCount,
						days: MEASUREMENT_BASELINE_WINDOW_DAYS,
					})}
				</AppText>
				<AppText color="muted">{t("body:overview.rangeNote")}</AppText>
			</ModalSheet>
		</>
	);
}
const styles = StyleSheet.create((theme) => ({
	summary: { gap: theme.spacing.xs, flexShrink: 0 },
	value: {
		flexShrink: 1,
	},
	range: {
		minHeight: theme.control.minHitArea,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
	},
	rangeCopy: { flex: 1 },
	swatch: {
		width: 32,
		height: 16,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.historyFill,
	},
}));
