import { router, Tabs, usePathname, useSegments } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BodyLogSurfaceProvider } from "../../body/body-log-surface-context";
import { AppHeader } from "../../components/app-header";
import { HeaderIconButton } from "../../components/header-icon-button";
import { Icon } from "../../components/icon";
import { QuickLogFab } from "../../components/quick-log-fab";
import {
	TodayHeaderMonthProvider,
	useTodayHeaderMonth,
} from "../../components/today-header-month-context";
import { playSelectionHaptic } from "../../feedback/selection-haptic";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

/** Values are keys in the `navigation` catalogue, not copy. */
const TAB_TITLE_KEYS = {
	"/": "tabs.journal",
	"/intake": "tabs.intake",
	"/body": "tabs.body",
	"/life": "tabs.life",
} as const;

const TAB_BAR_CONTENT_HEIGHT = 56;

function TabShell() {
	const { t } = useTranslation("navigation");
	const { theme } = useUnistyles();
	const insets = useSafeAreaInsets();
	const pathname = usePathname();
	const segments = useSegments() as string[];
	const todayHeaderMonth = useTodayHeaderMonth();
	const activeTabKey = TAB_TITLE_KEYS[pathname as keyof typeof TAB_TITLE_KEYS];
	const activeTabTitle = activeTabKey ? t(activeTabKey) : undefined;
	const activeHeaderTitle =
		pathname === "/" ? todayHeaderMonth : activeTabTitle;
	const isJournalTab = pathname === "/";
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
					centerTitle={header.isJournal}
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
						header.isJournal ? (
							<HeaderIconButton
								icon="calendar"
								testID="history-header-icon"
								label={t("tabs.openHistory")}
								onPress={() => router.push("/history")}
							/>
						) : null
					}
				/>
			) : null}
			<Tabs
				detachInactiveScreens={false}
				screenListeners={({ route }) => ({
					tabPress: () => {
						if (route.name !== activeTabName) playSelectionHaptic();
					},
				})}
				screenOptions={{
					headerShown: false,
					// Domain dashboards initialise repositories and charts. Mount them on
					// first use, then keep them attached for quick returns.
					lazy: true,
					sceneStyle: { backgroundColor: theme.colors.background },
					tabBarActiveTintColor: theme.colors.text,
					tabBarInactiveTintColor: theme.colors.tabInactive,
					tabBarStyle: {
						backgroundColor: theme.colors.tabBackground,
						borderTopWidth: 0,
						boxShadow: "none",
						elevation: 0,
						height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
					},
					tabBarLabelStyle: {
						...theme.typography.micro,
						fontWeight: "500",
					},
				}}
			>
				<Tabs.Screen
					name="index"
					options={{
						title: t("tabs.journal"),
						tabBarIcon: ({ color, size }) => (
							<Icon name="journal" color={color} size={size} />
						),
					}}
				/>
				<Tabs.Screen
					name="intake"
					options={{
						title: t("tabs.intake"),
						tabBarIcon: ({ color, size }) => (
							<Icon name="food" color={color} size={size} />
						),
					}}
				/>
				<Tabs.Screen
					name="body"
					options={{
						title: t("tabs.body"),
						tabBarIcon: ({ color, size }) => (
							<Icon name="body" color={color} size={size} />
						),
					}}
				/>
				<Tabs.Screen
					name="life"
					options={{
						title: t("tabs.life"),
						tabBarIcon: ({ color, size }) => (
							<Icon name="explore" color={color} size={size} />
						),
					}}
				/>
			</Tabs>
			{pathname === "/" || pathname === "/intake" || pathname === "/body" ? (
				<QuickLogFab
					bottom={TAB_BAR_CONTENT_HEIGHT + insets.bottom + theme.spacing.lg}
					bodyActive={pathname === "/body"}
				/>
			) : null}
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
	shell: { flex: 1, backgroundColor: theme.colors.background },
}));
