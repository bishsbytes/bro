// Registers themes before any screen renders.
import "../theme/unistyles";
import { AuthProvider } from "@bro/auth-app";
import {
	closeDb,
	closeDeviceSettings,
	type DeviceSettingsSnapshot,
	initDb,
	readDeviceSettings,
	runMigrations,
} from "@bro/database-app";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
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
				<Stack.Screen name="account" />
				<Stack.Screen name="history" />
				<Stack.Screen name="trends" />
				<Stack.Screen name="settings" />
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
			// Device settings read synchronously; only the product database and its
			// migrations are I/O the startup screen has to wait on.
			const settings = readDeviceSettings();
			const db = await initDb();
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
			// Release both handles first: runMigrations throws without closing, so a
			// retry would otherwise reopen against a half-known schema. Failures
			// closing are irrelevant here — reopening is what has to work.
			await closeDb().catch(() => undefined);
			try {
				closeDeviceSettings();
			} catch {
				// Already unusable; the reopen below reports the real problem.
			}
			await start();
		})();
	}, [start]);

	return (
		<View style={styles.container}>
			<StatusBar style="auto" />
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

const styles = StyleSheet.create((theme) => ({
	container: {
		flex: 1,
		backgroundColor: theme.colors.background,
	},
	centered: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: theme.spacing.xl,
	},
	errorTitle: {
		fontSize: 20,
		fontWeight: "600",
		color: theme.colors.text,
		marginBottom: theme.spacing.sm,
	},
	errorDetail: {
		fontSize: 15,
		color: theme.colors.textSubtle,
		textAlign: "center",
	},
	retryButton: {
		marginTop: theme.spacing.xl,
		backgroundColor: theme.colors.brand,
		borderRadius: theme.radius.sm,
		paddingHorizontal: theme.spacing.xl,
		paddingVertical: theme.spacing.md,
	},
	retryButtonText: {
		color: theme.colors.onBrand,
		fontSize: theme.typography.label.fontSize,
		fontWeight: "500",
	},
}));
