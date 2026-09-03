import { router, usePathname, useSegments } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { BodyLogSurfaceProvider } from "../../body/body-log-surface-context";
import { AppHeader } from "../../components/app-header";
import { HeaderIconButton } from "../../components/header-icon-button";
import { Icon, type IconName } from "../../components/icon";
import { QuickLogFab } from "../../components/quick-log-fab";
import {
	TodayHeaderMonthProvider,
	useTodayHeaderMonth,
} from "../../components/today-header-month-context";
import { playSelectionHaptic } from "../../feedback/selection-haptic";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

const TAB_TITLE_KEYS = {
	"/": "tabs.journal",
	"/intake": "tabs.intake",
	"/body": "tabs.body",
	"/life": "tabs.life",
} as const;

function TabIcon({ name }: { name: IconName }) {
	const { theme } = useUnistyles();
	return (
		<NativeTabs.Trigger.Icon
			renderingMode="template"
			src={{
				default: <Icon name={name} color={theme.colors.ink2} size={22} />,
				selected: <Icon name={name} color={theme.colors.accent} size={22} />,
			}}
		/>
	);
}

function TabShell() {
	const { t } = useTranslation("navigation");
	const { theme } = useUnistyles();
	const pathname = usePathname();
	const segments = useSegments() as string[];
	const todayHeaderMonth = useTodayHeaderMonth();
	const activeTabKey = TAB_TITLE_KEYS[pathname as keyof typeof TAB_TITLE_KEYS];
	const activeTabTitle = activeTabKey ? t(activeTabKey) : undefined;
	const activeHeaderTitle =
		pathname === "/" ? todayHeaderMonth : activeTabTitle;
	const isJournalTab = pathname === "/";
	const canQuickLog =
		pathname === "/" || pathname === "/intake" || pathname === "/body";
	const lastTabHeader = useRef(
		activeHeaderTitle
			? { title: activeHeaderTitle, isJournal: isJournalTab }
			: { title: todayHeaderMonth, isJournal: true },
	);

	useLayoutEffect(() => {
		if (activeHeaderTitle) {
			lastTabHeader.current = {
				title: activeHeaderTitle,
				isJournal: isJournalTab,
			};
		}
	}, [activeHeaderTitle, isJournalTab]);

	const isNestedTabRoute = segments[0] === "(tabs)" && segments.length > 2;
	const header = activeHeaderTitle
		? { title: activeHeaderTitle, isJournal: isJournalTab }
		: lastTabHeader.current;
	const title = isNestedTabRoute ? undefined : header.title;
	const activeTabName = pathname === "/" ? "index" : pathname.slice(1);

	return (
		<View style={styles.shell}>
			{title ? (
				<AppHeader
					title={title}
					leading={
						header.isJournal ? (
							<HeaderIconButton
								icon="insights"
								testID="insights-header-icon"
								label={t("tabs.openInsights")}
								onPress={() => router.push("/insights")}
							/>
						) : null
					}
					actions={
						<>
							{canQuickLog ? (
								<QuickLogFab bodyActive={pathname === "/body"} />
							) : null}
							{header.isJournal ? (
								<HeaderIconButton
									icon="calendar"
									testID="history-header-icon"
									label={t("tabs.openHistory")}
									onPress={() => router.push("/history")}
								/>
							) : null}
						</>
					}
				/>
			) : null}

			<NativeTabs
				backgroundColor={theme.colors.glass}
				blurEffect={
					theme.isDark
						? "systemUltraThinMaterialDark"
						: "systemUltraThinMaterialLight"
				}
				iconColor={{
					default: theme.colors.ink2,
					selected: theme.colors.accent,
				}}
				indicatorColor={theme.colors.accentDeep}
				labelStyle={{
					default: {
						fontFamily: theme.fonts.sans,
						fontSize: 12,
						color: theme.colors.ink2,
					},
					selected: {
						fontFamily: theme.fonts.sans,
						fontSize: 12,
						color: theme.colors.accent,
					},
				}}
				minimizeBehavior="onScrollDown"
				shadowColor={theme.colors.hairlineStrong}
				screenListeners={({ route }) => ({
					tabPress: () => {
						if (route.name !== activeTabName) playSelectionHaptic();
					},
				})}
			>
				<NativeTabs.Trigger name="index">
					<TabIcon name="journal" />
					<NativeTabs.Trigger.Label>
						{t("tabs.journal")}
					</NativeTabs.Trigger.Label>
				</NativeTabs.Trigger>
				<NativeTabs.Trigger name="intake">
					<TabIcon name="food" />
					<NativeTabs.Trigger.Label>
						{t("tabs.intake")}
					</NativeTabs.Trigger.Label>
				</NativeTabs.Trigger>
				<NativeTabs.Trigger name="body">
					<TabIcon name="body" />
					<NativeTabs.Trigger.Label>{t("tabs.body")}</NativeTabs.Trigger.Label>
				</NativeTabs.Trigger>
				<NativeTabs.Trigger name="life">
					<TabIcon name="explore" />
					<NativeTabs.Trigger.Label>{t("tabs.life")}</NativeTabs.Trigger.Label>
				</NativeTabs.Trigger>
			</NativeTabs>
		</View>
	);
}

export default function TabLayout() {
	return (
		<BodyLogSurfaceProvider>
			<TodayHeaderMonthProvider>
				<TabShell />
			</TodayHeaderMonthProvider>
		</BodyLogSurfaceProvider>
	);
}

const styles = StyleSheet.create((theme) => ({
	shell: { flex: 1, backgroundColor: theme.colors.base },
}));
