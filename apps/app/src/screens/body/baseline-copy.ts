import { formatLocalDayLabelShort } from "@bro/logic";
import type { TFunction } from "i18next";
import type { BodyMetricSummary } from "../../body/body-store";

export type BodyText = TFunction<["body", "common"]>;

export function dayLabel(
	localDay: string,
	todayLocalDay: string,
	locale: string | undefined,
): string {
	return formatLocalDayLabelShort(localDay, todayLocalDay, locale);
}

/**
 * The sentence naming the change since the reading before, with no verdict on
 * it. Shared by the compact row and the full gauge because both speak it to a
 * screen reader: two copies would eventually disagree about the same reading.
 */
export function changeSentence(
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
