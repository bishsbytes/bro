import {
	resolveMetric,
	TAPE_SITE_SLUGS,
	type TapeSiteSlug,
} from "@bro/domain/metric-registry";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { StackScreen as Screen } from "../../components/screen";
import { StyleSheet } from "../../theme/unistyles";
import { TapeFigure } from "./tape-figure";

function siteLabel(slug: TapeSiteSlug): string {
	const resolved = resolveMetric(slug);
	if (resolved.kind !== "known") {
		throw new TypeError(`Unknown tape site: ${slug}`);
	}
	return resolved.metric.label;
}

/**
 * Where the tape goes, and how to hold it.
 *
 * The figure belongs here rather than on the body tab: it answers a question
 * asked once or twice — "where exactly is the waist?" — and answering it is all
 * it does. It carries no readings, so nothing about a man's own numbers is
 * pinned to a drawing of a body.
 */
export function MeasuringGuideScreen({
	initialSite = "waist",
}: {
	initialSite?: TapeSiteSlug;
}) {
	const { t } = useTranslation("body");
	const [selected, setSelected] = useState<TapeSiteSlug>(initialSite);

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("measuring.intro")}</AppText>

			<TapeFigure
				sites={TAPE_SITE_SLUGS.map((slug) => ({
					slug,
					label: siteLabel(slug),
					accessibilityLabel: t("measuring.siteA11y", {
						name: siteLabel(slug),
					}),
				}))}
				selectedSlug={selected}
				onSelect={setSelected}
			/>

			<Card style={styles.panel}>
				<AppText variant="section">{siteLabel(selected)}</AppText>
				<AppText>{t(`measuring.sites.${selected}`)}</AppText>
			</Card>

			<View style={styles.notes}>
				<AppText variant="label">{t("measuring.everySiteTitle")}</AppText>
				<AppText color="muted">{t("measuring.everySite")}</AppText>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	panel: { gap: theme.spacing.sm },
	notes: { gap: theme.spacing.sm },
}));

export default MeasuringGuideScreen;
