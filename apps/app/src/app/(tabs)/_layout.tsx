import { useAuth } from "@bro/auth-app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, Tabs, usePathname, useSegments } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "../../components/app-header";
import { AvatarIdentityContext } from "../../components/avatar-identity-context";
import { QuickLogFab } from "../../components/quick-log-fab";
import {
	TodayHeaderMonthProvider,
	useTodayHeaderMonth,
} from "../../components/today-header-month-context";
import { playSelectionHaptic } from "../../feedback/selection-haptic";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

/** Values are keys in the `navigation` catalogue, not copy. */
const TAB_TITLE_KEYS = {
	"/": "tabs.today",
	"/log": "tabs.log",
	"/insights": "tabs.insights",
	"/life": "tabs.life",
} as const;

const TAB_BAR_CONTENT_HEIGHT = 56;

function TabShell() {
	const { t } = useTranslation("navigation");
	const { theme } = useUnistyles();
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
	const pathname = usePathname();
	const segments = useSegments() as string[];
	const todayHeaderMonth = useTodayHeaderMonth();
	const activeTabKey = TAB_TITLE_KEYS[pathname as keyof typeof TAB_TITLE_KEYS];
	const activeTabTitle = activeTabKey ? t(activeTabKey) : undefined;
	const activeHeaderTitle =
		pathname === "/" ? todayHeaderMonth : activeTabTitle;
	const lastTabTitle = useRef(activeHeaderTitle ?? todayHeaderMonth);
	useLayoutEffect(() => {
		if (activeHeaderTitle) {
			lastTabTitle.current = activeHeaderTitle;
		}
	}, [activeHeaderTitle]);
	const isNestedTabRoute = segments[0] === "(tabs)" && segments.length > 2;
	const title = isNestedTabRoute
		? undefined
		: (activeHeaderTitle ?? lastTabTitle.current);
	const activeTabName = pathname === "/" ? "index" : pathname.slice(1);

	return (
		<AvatarIdentityContext.Provider value={user?.name ?? null}>
			<View style={styles.shell}>
				{title ? (
					<AppHeader
						title={title}
						centerTitle={pathname === "/"}
						leading={
							pathname === "/" ? (
								<TouchableOpacity
									accessibilityRole="button"
									accessibilityLabel={t("tabs.openHistory")}
									hitSlop={theme.spacing.sm}
									style={styles.headerAction}
									onPress={() => router.push("/history")}
								>
									<MaterialIcons
										testID="history-header-icon"
										name="calendar-today"
										color={theme.colors.text}
										size={theme.control.avatarIconSize}
									/>
								</TouchableOpacity>
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
							title: t("tabs.today"),
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="wb-sunny" color={color} size={size} />
							),
						}}
					/>
					<Tabs.Screen
						name="log"
						options={{
							title: t("tabs.log"),
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="edit-note" color={color} size={size} />
							),
						}}
					/>
					<Tabs.Screen
						name="insights"
						options={{
							title: t("tabs.insights"),
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="insights" color={color} size={size} />
							),
						}}
					/>
					<Tabs.Screen
						name="life"
						options={{
							title: t("tabs.life"),
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="explore" color={color} size={size} />
							),
						}}
					/>
				</Tabs>
				{pathname === "/" || pathname === "/log" ? (
					<QuickLogFab
						bottom={TAB_BAR_CONTENT_HEIGHT + insets.bottom + theme.spacing.lg}
					/>
				) : null}
			</View>
		</AvatarIdentityContext.Provider>
	);
}

export default function TabLayout() {
	return (
		<TodayHeaderMonthProvider>
			<TabShell />
		</TodayHeaderMonthProvider>
	);
}

const styles = StyleSheet.create((theme) => ({
	shell: { flex: 1, backgroundColor: theme.colors.background },
	headerAction: {
		width: theme.control.avatarSize,
		height: theme.control.avatarSize,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 0,
		borderRadius: theme.control.avatarSize / 2,
		backgroundColor: "transparent",
	},
}));
