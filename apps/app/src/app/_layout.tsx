import { AuthProvider } from "@bro/auth-app";
import {
	closeDb,
	closeDeviceSettingsDb,
	type DeviceSettingsSnapshot,
	initDb,
	initDeviceSettings,
	runMigrations,
} from "@bro/database-app";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import {
	DeviceSettingsProvider,
	useDeviceSettings,
} from "../providers/device-settings-provider";

void SplashScreen.preventAutoHideAsync();

type StartupState =
	| { kind: "loading" }
	| { kind: "ready"; settings: DeviceSettingsSnapshot }
	| { kind: "error"; error: Error };

function Loading() {
	return (
		<View style={styles.centered}>
			<ActivityIndicator size="large" />
		</View>
	);
}

function StorageError({
	error,
	onRetry,
}: {
	error: Error;
	onRetry: () => void;
}) {
	return (
		<View style={styles.centered}>
			<Text style={styles.errorTitle}>Local storage is unavailable</Text>
			<Text style={styles.errorDetail}>{error.message}</Text>
			<TouchableOpacity style={styles.retryButton} onPress={onRetry}>
				<Text style={styles.retryButtonText}>Try again</Text>
			</TouchableOpacity>
		</View>
	);
}

function AppProviders() {
	const { settings, markRemoteSessionStored, clearRemoteSession } =
		useDeviceSettings();

	return (
		<AuthProvider
			hasStoredRemoteSession={settings.hasStoredRemoteSession}
			onRemoteSessionStored={markRemoteSessionStored}
			onRemoteSessionCleared={clearRemoteSession}
		>
			<RootNavigator />
		</AuthProvider>
	);
}

function RootNavigator() {
	const { settings } = useDeviceSettings();

	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Protected guard={!settings.onboardingComplete}>
				<Stack.Screen name="onboarding" />
			</Stack.Protected>
			<Stack.Protected guard={settings.onboardingComplete}>
				<Stack.Screen name="index" />
			</Stack.Protected>
			<Stack.Screen name="sign-in" />
			<Stack.Screen name="sign-up" />
		</Stack>
	);
}

export default function RootLayout() {
	const [startup, setStartup] = useState<StartupState>({ kind: "loading" });

	const start = useCallback(async () => {
		setStartup({ kind: "loading" });

		try {
			const settings = await initDeviceSettings();
			const db = await initDb(settings.activeWorkspace.databaseFileName);
			await runMigrations(db);
			setStartup({ kind: "ready", settings });
		} catch (caught) {
			setStartup({
				kind: "error",
				error: caught instanceof Error ? caught : new Error(String(caught)),
			});
		} finally {
			await SplashScreen.hideAsync();
		}
	}, []);

	useEffect(() => {
		void start();
	}, [start]);

	const retry = useCallback(() => {
		void (async () => {
			await Promise.allSettled([closeDb(), closeDeviceSettingsDb()]);
			await start();
		})();
	}, [start]);

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />
			{startup.kind === "loading" ? <Loading /> : null}
			{startup.kind === "error" ? (
				<StorageError error={startup.error} onRetry={retry} />
			) : null}
			{startup.kind === "ready" ? (
				<DeviceSettingsProvider initialSettings={startup.settings}>
					<AppProviders />
				</DeviceSettingsProvider>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
	},
	centered: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 24,
	},
	errorTitle: {
		fontSize: 20,
		fontWeight: "600",
		marginBottom: 8,
	},
	errorDetail: {
		fontSize: 15,
		color: "#6b7280",
		textAlign: "center",
	},
	retryButton: {
		marginTop: 24,
		backgroundColor: "#143055",
		borderRadius: 8,
		paddingHorizontal: 24,
		paddingVertical: 12,
	},
	retryButtonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "500",
	},
});
