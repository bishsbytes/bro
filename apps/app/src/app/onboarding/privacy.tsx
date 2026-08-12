import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { onboardingStyles as styles } from "../../screens/onboarding-styles";

export default function PrivacyRoute() {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>Your data stays on your phone</Text>
			<Text style={styles.body}>
				Everything you write is stored on this device and nowhere else. We
				cannot read it, because we never have it.
			</Text>
			<Text style={styles.body}>
				Works offline, on a plane, in a tunnel, with no signal at all.
			</Text>
			<TouchableOpacity
				style={styles.primaryButton}
				onPress={() => router.push("/onboarding/start")}
			>
				<Text style={styles.primaryButtonText}>Continue</Text>
			</TouchableOpacity>
		</View>
	);
}
