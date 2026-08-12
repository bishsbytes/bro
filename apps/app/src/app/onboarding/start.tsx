import { router } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useDeviceSettings } from "../../providers/device-settings-provider";
import { onboardingStyles as styles } from "../../screens/onboarding-styles";

export default function StartRoute() {
	const { completeOnboarding } = useDeviceSettings();
	const [submitting, setSubmitting] = useState(false);

	const start = async () => {
		setSubmitting(true);
		try {
			await completeOnboarding();
			router.replace("/");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Ready when you are</Text>
			<Text style={styles.body}>
				Use the core app for free, for as long as you want, with no account.
			</Text>
			<Text style={styles.body}>
				Later, if you want your notes on more than one device, you can add an
				account and upgrade. Up to you — the app works fully without either.
			</Text>
			<TouchableOpacity
				style={styles.primaryButton}
				onPress={() => void start()}
				disabled={submitting}
			>
				<Text style={styles.primaryButtonText}>
					{submitting ? "Starting…" : "Start using the app"}
				</Text>
			</TouchableOpacity>
			<TouchableOpacity
				style={styles.secondaryButton}
				onPress={() => router.push("/sign-in")}
				disabled={submitting}
			>
				<Text style={styles.secondaryButtonText}>
					I already have an account
				</Text>
			</TouchableOpacity>
		</View>
	);
}
