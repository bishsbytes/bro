import { router } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppHeader } from "./app-header";
import { HeaderIconButton } from "./header-icon-button";
import { useLogDate } from "./log-date-context";

const TITLE_KEYS = {
	journal: "tabs.journalTitle",
	intake: "tabs.intakeTitle",
	body: "tabs.bodyTitle",
	life: "tabs.lifeTitle",
} as const;

/** Keep each header in its native tab so it switches with the page. */
export function TabScreen({
	tab,
	children,
}: {
	tab: keyof typeof TITLE_KEYS;
	children: ReactNode;
}) {
	const { t, i18n } = useTranslation("navigation");
	const localDay = useLogDate(tab);
	const isJournal = tab === "journal";
	const dated = isJournal || tab === "intake";
	const date = dated
		? new Intl.DateTimeFormat(i18n.language, {
				weekday: "long",
				day: "numeric",
				month: "long",
				timeZone: "UTC",
			}).format(new Date(`${localDay}T00:00:00.000Z`))
		: undefined;
	const eyebrow = dated ? date : t(`tabs.${tab}` as const);

	return (
		<View style={styles.screen}>
			<AppHeader
				title={t(TITLE_KEYS[tab])}
				stacked
				eyebrow={eyebrow}
				eyebrowAccessibilityLabel={
					isJournal ? t("tabs.openHistory") : undefined
				}
				onEyebrowPress={isJournal ? () => router.push("/history") : undefined}
				showSettings={!isJournal}
				actions={
					isJournal ? (
						<HeaderIconButton
							icon="insights"
							testID="insights-header-icon"
							label={t("tabs.openInsights")}
							onPress={() => router.push("/insights")}
							surface
						/>
					) : null
				}
			/>
			{children}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	screen: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
}));
