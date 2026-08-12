import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { onboardingStyles as styles } from "../../screens/onboarding-styles";

export default function WelcomeRoute() {
	return (
		<View style={styles.container}>
			<Text style={styles.eyebrow}>bro</Text>
			<Text style={styles.title}>
				A private place to check in with yourself.
			</Text>
			<Text style={styles.body}>
				No account. No sign-up. Nothing to fill in first.
			</Text>
			<TouchableOpacity
				style={styles.primaryButton}
				onPress={() => router.push("/onboarding/privacy")}
			>
				<Text style={styles.primaryButtonText}>Continue</Text>
			</TouchableOpacity>
		</View>
	);
}
