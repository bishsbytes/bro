import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAuth } from "@bro/auth-app";
import { Tabs, usePathname, useSegments } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { View } from "react-native";
import { AvatarIdentityContext } from "../../components/avatar-identity-context";
import { AppHeader } from "../../components/app-header";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

const TAB_TITLES = {
	"/": "Today",
	"/history": "History",
	"/trends": "Trends",
	"/settings": "Settings",
} as const;

export default function TabLayout() {
	const { theme } = useUnistyles();
	const { user } = useAuth();
	const pathname = usePathname();
	const segments = useSegments() as string[];
	const activeTabTitle = TAB_TITLES[pathname as keyof typeof TAB_TITLES];
	const lastTabTitle = useRef(activeTabTitle ?? "Today");
	useLayoutEffect(() => {
		if (activeTabTitle) {
			lastTabTitle.current = activeTabTitle;
		}
	}, [activeTabTitle]);
	const isNestedTabRoute = segments[0] === "(tabs)" && segments.length > 2;
	const title = isNestedTabRoute
		? undefined
		: (activeTabTitle ?? lastTabTitle.current);

	return (
		<AvatarIdentityContext.Provider value={user?.name ?? null}>
			<View style={styles.shell}>
				{title ? <AppHeader title={title} /> : null}
				<Tabs
					detachInactiveScreens={false}
					screenOptions={{
						headerShown: false,
						// Keep each lightweight, local-data tab mounted from startup so its
						// scene is ready before the first tab press.
						lazy: false,
						sceneStyle: { backgroundColor: theme.colors.background },
						tabBarActiveTintColor: theme.colors.brand,
						tabBarInactiveTintColor: theme.colors.tabInactive,
						tabBarStyle: {
							backgroundColor: theme.colors.tabBackground,
							borderTopColor: theme.colors.headerBorder,
						},
						tabBarLabelStyle: theme.typography.micro,
						tabBarActiveBackgroundColor: theme.colors.tabIndicator,
					}}
				>
					<Tabs.Screen
						name="index"
						options={{
							title: "Today",
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="home" color={color} size={size} />
							),
						}}
					/>
					<Tabs.Screen
						name="history"
						options={{
							title: "History",
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="history" color={color} size={size} />
							),
						}}
					/>
					<Tabs.Screen
						name="trends"
						options={{
							title: "Trends",
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="show-chart" color={color} size={size} />
							),
						}}
					/>
					<Tabs.Screen
						name="settings"
						options={{
							title: "Settings",
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="settings" color={color} size={size} />
							),
						}}
					/>
				</Tabs>
			</View>
		</AvatarIdentityContext.Provider>
	);
}

const styles = StyleSheet.create((theme) => ({
	shell: { flex: 1, backgroundColor: theme.colors.background },
}));
