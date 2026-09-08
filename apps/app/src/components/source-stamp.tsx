import { useTranslation } from "react-i18next";
import { healthPlatformLabel } from "../health/platform-label";
import { AppText } from "./app-text";

/** Daily imports have a day, not a sensor timestamp. Never invent a time for them. */
export function SourceStamp({
	source,
	observedAt,
	localDay,
	locale,
}: {
	source: string;
	observedAt: number;
	localDay: string;
	locale?: string;
}) {
	const { t } = useTranslation("body");
	const when =
		source === "user"
			? new Date(observedAt).toLocaleString(locale, {
					day: "numeric",
					month: "short",
					year: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				})
			: formatReadingDay(localDay, locale);
	return (
		<AppText variant="footnote" color="muted">
			{t("reading.stamp", {
				when,
				source:
					healthPlatformLabel(source) ??
					(source === "user" ? t("reading.manual") : source),
			})}
		</AppText>
	);
}

export function formatReadingDay(localDay: string, locale?: string): string {
	const date = new Date(`${localDay}T12:00:00Z`);
	if (!Number.isFinite(date.getTime())) return localDay;
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
		...(date.getUTCFullYear() !== new Date().getFullYear()
			? { year: "numeric" as const }
			: {}),
		timeZone: "UTC",
	}).format(date);
}
