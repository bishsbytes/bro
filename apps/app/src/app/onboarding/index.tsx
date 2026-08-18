import { router } from "expo-router";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FullScreen as Screen } from "../../components/screen";
import { onboardingStyles as styles } from "../../screens/onboarding/onboarding-styles";

export default function WelcomeRoute() {
	return (
		<Screen padded centered contentContainerStyle={styles.container}>
			<AppText variant="label" color="brand" style={styles.eyebrow}>
				bro
			</AppText>
			<AppText variant="display" style={styles.title}>
				A private place to check in with yourself.
			</AppText>
			<AppText color="muted" style={styles.body}>
				No account. No sign-up. Nothing to fill in first.
			</AppText>
			<Button
				label="Continue"
				style={styles.primaryButton}
				onPress={() => router.push("/onboarding/privacy")}
			/>
		</Screen>
	);
}
