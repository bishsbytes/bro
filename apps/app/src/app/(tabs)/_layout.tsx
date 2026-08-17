import { useAuth } from "@bro/auth-app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, Tabs, usePathname, useSegments } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { TouchableOpacity, View } from "react-native";
import { AppHeader } from "../../components/app-header";
import { AvatarIdentityContext } from "../../components/avatar-identity-context";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

const TAB_TITLES = {
	"/": "Today",
	"/body": "Body",
	"/mind": "Mind",
	"/life": "Life",
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
				{title ? (
					<AppHeader
						title={title}
						actions={
							pathname === "/" ? (
								<TouchableOpacity
									accessibilityRole="button"
									accessibilityLabel="Open history"
									hitSlop={theme.spacing.sm}
									style={styles.headerAction}
									onPress={() => router.push("/history")}
								>
									<MaterialIcons
										name="calendar-today"
										color={theme.colors.brand}
										size={theme.control.avatarIconSize}
									/>
								</TouchableOpacity>
							) : null
						}
					/>
				) : null}
				<Tabs
					detachInactiveScreens={false}
					screenOptions={{
						headerShown: false,
						// Domain dashboards initialise repositories and charts. Mount them on
						// first use, then keep them attached for quick returns.
						lazy: true,
						sceneStyle: { backgroundColor: theme.colors.background },
						tabBarActiveTintColor: theme.colors.brand,
						tabBarInactiveTintColor: theme.colors.tabInactive,
						tabBarStyle: {
							backgroundColor: theme.colors.tabBackground,
							borderTopWidth: 0,
							shadowOpacity: 0,
							elevation: 0,
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
							title: "Today",
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="wb-sunny" color={color} size={size} />
							),
						}}
					/>
					<Tabs.Screen
						name="body"
						options={{
							title: "Body",
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons
									name="fitness-center"
									color={color}
									size={size}
								/>
							),
						}}
					/>
					<Tabs.Screen
						name="mind"
						options={{
							title: "Mind",
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="psychology" color={color} size={size} />
							),
						}}
					/>
					<Tabs.Screen
						name="life"
						options={{
							title: "Life",
							tabBarIcon: ({ color, size }) => (
								<MaterialIcons name="explore" color={color} size={size} />
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
	headerAction: {
		width: theme.control.avatarSize,
		height: theme.control.avatarSize,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.control.avatarSize / 2,
		backgroundColor: theme.colors.surface,
	},
}));
