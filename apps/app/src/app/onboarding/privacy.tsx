import { router } from "expo-router";
import { Button } from "../../components/button";
import { FullScreen as Screen } from "../../components/screen";
import { onboardingStyles as styles } from "../../screens/onboarding/onboarding-styles";
import { PrivacyContent } from "../../screens/privacy/privacy-content";

export default function PrivacyRoute() {
	return (
		<Screen scroll padded contentContainerStyle={styles.container}>
			<PrivacyContent />
			<Button
				label="Continue"
				style={styles.primaryButton}
				onPress={() => router.push("/onboarding/start")}
			/>
		</Screen>
	);
}
