import { AuthProvider, useAuth } from "@bro/auth-app";
import { initDb, runMigrations } from "@bro/database-app";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

// Keep the native splash visible while the local database is initialized.
void SplashScreen.preventAutoHideAsync();

function Loading() {
	return (
		<View style={styles.centered}>
			<ActivityIndicator size="large" />
		</View>
	);
}

function StartupError({ error }: { error: Error }) {
	return (
		<View style={styles.centered}>
			<Text style={styles.errorTitle}>Couldn't start up</Text>
			<Text style={styles.errorDetail}>{error.message}</Text>
		</View>
	);
}

function RootNavigator() {
	const { error, isPending, isSignedIn } = useAuth();

	if (isPending) {
		return <Loading />;
	}

	if (error) {
		return (
			<StartupError
				error={new Error(error.message ?? "Could not load your session.")}
			/>
		);
	}

	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Protected guard={isSignedIn}>
				<Stack.Screen name="index" />
			</Stack.Protected>

			<Stack.Protected guard={!isSignedIn}>
				<Stack.Screen name="sign-in" />
				<Stack.Screen name="sign-up" />
			</Stack.Protected>
		</Stack>
	);
}

export default function RootLayout() {
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		const start = async () => {
			try {
				const db = await initDb();
				await runMigrations(db);
				setReady(true);
			} catch (caught) {
				setError(caught instanceof Error ? caught : new Error(String(caught)));
			} finally {
				await SplashScreen.hideAsync();
			}
		};

		void start();
	}, []);

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />
			{error ? <StartupError error={error} /> : null}
			{!error && !ready ? <Loading /> : null}
			{!error && ready ? (
				<AuthProvider>
					<RootNavigator />
				</AuthProvider>
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
});
