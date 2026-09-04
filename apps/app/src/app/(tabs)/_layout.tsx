import { router, usePathname, useSegments } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BodyLogSurfaceProvider } from "../../body/body-log-surface-context";
import { AppHeader } from "../../components/app-header";
import { HeaderIconButton } from "../../components/header-icon-button";
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

// Native tabs own their platform-specific bar, so the floating action clears
// the standard bar content plus the device's bottom inset.
const NATIVE_TAB_BAR_CONTENT_HEIGHT = Platform.select({
	android: 80,
	ios: 49,
	default: 56,
});

function TabShell() {
	const { t } = useTranslation("navigation");
	const { theme } = useUnistyles();
	const insets = useSafeAreaInsets();
	const pathname = usePathname();
	const segments = useSegments() as string[];
	const todayHeaderMonth = useTodayHeaderMonth();
	const activeTabKey = TAB_TITLE_KEYS[pathname as keyof typeof TAB_TITLE_KEYS];
	const isJournalTab = pathname === "/";
	const activeHeaderTitle = isJournalTab
		? todayHeaderMonth
		: activeTabKey
			? t(activeTabKey)
			: undefined;
	const canQuickLog =
		pathname === "/" || pathname === "/intake" || pathname === "/body";
	const lastTabHeader = useRef(
		activeHeaderTitle
			? {
					title: activeHeaderTitle,
					isJournal: isJournalTab,
				}
			: {
					title: todayHeaderMonth,
					isJournal: true,
				},
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
		? {
				title: activeHeaderTitle,
				isJournal: isJournalTab,
			}
		: lastTabHeader.current;
	const title = isNestedTabRoute ? undefined : header.title;
	const activeTabName = pathname === "/" ? "index" : pathname.slice(1);

	return (
		<View style={styles.shell}>
			{title ? (
				<AppHeader
					title={title}
					eyebrowAccessibilityLabel={
						header.isJournal ? t("tabs.openHistory") : undefined
					}
					onEyebrowPress={
						header.isJournal ? () => router.push("/history") : undefined
					}
					showSettings={!header.isJournal}
					actions={
						header.isJournal ? (
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
				// `auto` drops to selected-only labels past three tabs, and there are
				// four - so every label is pinned on instead.
				labelVisibilityMode="labeled"
				// Left unset, the ripple falls back to the Material `itemRippleColor`
				// attribute, which the host theme does not define as a flat colour.
				rippleColor={theme.colors.tabRipple}
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
				{/*
				 * The native bar renders a UIImage/drawable, not React views, so the
				 * Lucide set the rest of the app draws with cannot reach it - each tab
				 * names a platform symbol instead. iOS pairs an outline with its `.fill`
				 * twin where one exists; Material Symbols have no filled twins here and
				 * signal selection through the indicator, so Android names one symbol.
				 */}
				<NativeTabs.Trigger name="index">
					<NativeTabs.Trigger.Icon
						sf={{ default: "sun.max", selected: "sun.max.fill" }}
						md="sunny"
					/>
					<NativeTabs.Trigger.Label>
						{t("tabs.journal")}
					</NativeTabs.Trigger.Label>
				</NativeTabs.Trigger>
				<NativeTabs.Trigger name="intake">
					<NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" />
					<NativeTabs.Trigger.Label>
						{t("tabs.intake")}
					</NativeTabs.Trigger.Label>
				</NativeTabs.Trigger>
				<NativeTabs.Trigger name="body">
					<NativeTabs.Trigger.Icon
						sf={{ default: "scalemass", selected: "scalemass.fill" }}
						md="monitor_weight"
					/>
					<NativeTabs.Trigger.Label>{t("tabs.body")}</NativeTabs.Trigger.Label>
				</NativeTabs.Trigger>
				<NativeTabs.Trigger name="life">
					<NativeTabs.Trigger.Icon
						sf={{ default: "safari", selected: "safari.fill" }}
						md="explore"
					/>
					<NativeTabs.Trigger.Label>{t("tabs.life")}</NativeTabs.Trigger.Label>
				</NativeTabs.Trigger>
			</NativeTabs>
			{canQuickLog ? (
				<QuickLogFab
					bottom={
						NATIVE_TAB_BAR_CONTENT_HEIGHT +
						insets.bottom +
						theme.spacing.lg
					}
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
	shell: { flex: 1, backgroundColor: theme.colors.base },
}));
