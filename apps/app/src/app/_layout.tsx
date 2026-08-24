import { AuthProvider } from "@bro/auth-app";
import {
	closeDb,
	closeDeviceSettings,
	closeLocalDb,
	type DeviceSettingsSnapshot,
	initDb,
	initLocalDb,
	readDeviceSettings,
	runLocalMigrations,
	runMigrations,
} from "@bro/database-app";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { LoadingIndicator } from "../components/loading-indicator";
import { HealthImportEffects } from "../health/health-import-effects";
import {
	DeviceSettingsProvider,
	useDeviceSettings,
} from "../providers/device-settings-provider";
import { ReminderNotificationEffects } from "../reminders/reminder-notification-effects";
import {
	applyAppearance,
	StyleSheet,
	stackScreenOptions,
	useUnistyles,
} from "../theme/unistyles";

void SplashScreen.preventAutoHideAsync();

type StartupState =
	| { kind: "loading" }
	| { kind: "ready"; settings: DeviceSettingsSnapshot }
	| { kind: "error"; error: Error };

function Loading() {
	return (
		<View style={styles.centered}>
			<LoadingIndicator size="large" />
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
		<>
			<HealthImportEffects />
			<ReminderNotificationEffects
				onboardingComplete={settings.onboardingComplete}
			/>
			<AuthProvider
				hasStoredRemoteSession={settings.hasStoredRemoteSession}
				onRemoteSessionStored={markRemoteSessionStored}
				onRemoteSessionCleared={clearRemoteSession}
			>
				<RootNavigator />
			</AuthProvider>
		</>
	);
}

function RootNavigator() {
	const { settings } = useDeviceSettings();
	const { theme } = useUnistyles();

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Protected guard={!settings.onboardingComplete}>
				<Stack.Screen name="onboarding" options={{ headerShown: false }} />
			</Stack.Protected>
			<Stack.Protected guard={settings.onboardingComplete}>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen name="check-in" options={{ headerShown: false }} />
				<Stack.Screen name="review" options={{ headerShown: false }} />
				<Stack.Screen name="history" options={{ headerShown: false }} />
				<Stack.Screen name="settings" options={{ headerShown: false }} />
				<Stack.Screen name="drinks" options={{ headerShown: false }} />
				<Stack.Screen name="food" options={{ headerShown: false }} />
				<Stack.Screen name="habits" options={{ headerShown: false }} />
				<Stack.Screen name="life-areas" options={{ title: "Life areas" }} />
				<Stack.Screen name="body/[slug]" options={{ title: "Measurement" }} />
				<Stack.Screen name="challenges" options={{ headerShown: false }} />
				<Stack.Screen name="insights/[id]" options={{ title: "Insight" }} />
				<Stack.Screen name="account" options={{ title: "Account" }} />
			</Stack.Protected>
			<Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
			<Stack.Screen name="sign-up" options={{ title: "Create account" }} />
		</Stack>
	);
}

export default function RootLayout() {
	const [startup, setStartup] = useState<StartupState>({ kind: "loading" });
	const { rt } = useUnistyles();

	const start = useCallback(async () => {
		setStartup({ kind: "loading" });

		try {
			// Device settings read synchronously; both relational stores and their
			// independent migrations are I/O the startup screen has to wait on.
			const settings = readDeviceSettings();
			applyAppearance(settings.themeMode, settings.accentColor);
			const [db, localDb] = await Promise.all([initDb(), initLocalDb()]);
			await Promise.all([runMigrations(db), runLocalMigrations(localDb)]);
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
			// Release both database handles first: a migrator throws without closing,
			// so a retry would otherwise reopen against a half-known schema. Failures
			// closing are irrelevant here — reopening is what has to work.
			await Promise.all([
				closeDb().catch(() => undefined),
				closeLocalDb().catch(() => undefined),
			]);
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
			<SystemBars style={rt.themeName === "dark" ? "light" : "dark"} />
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
