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
			: localDay;
	return (
		<AppText variant="caption" color="muted">
			{t("latestWithSource", {
				when,
				source:
					healthPlatformLabel(source) ??
					(source === "user" ? t("reading.manual") : source),
			})}
		</AppText>
	);
}
