import { AuthProvider, useAuth } from "@bro/auth-app";
import { initDb, runMigrations } from "@bro/database-app";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { HomeScreen } from "../screens/home-screen";
import { SignInScreen } from "../screens/sign-in-screen";
import { SignUpScreen } from "../screens/sign-up-screen";

// Held until the database is open and migrated.
SplashScreen.preventAutoHideAsync();

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

/**
 * Chooses between the signed-in and signed-out experience. No navigation
 * library is installed yet, so this is a deliberate conditional render rather
 * than a route stack.
 */
function Root() {
	const { error, isPending, isSignedIn } = useAuth();
	const [showSignUp, setShowSignUp] = useState(false);

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

	if (isSignedIn) {
		return <HomeScreen />;
	}

	return showSignUp ? (
		<SignUpScreen onShowSignIn={() => setShowSignUp(false)} />
	) : (
		<SignInScreen onShowSignUp={() => setShowSignUp(true)} />
	);
}

export const App = () => {
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
					<Root />
				</AuthProvider>
			) : null}
		</View>
	);
};

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

export default App;
