import { router } from "expo-router";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FullScreen as Screen } from "../../components/screen";
import { onboardingStyles as styles } from "../../screens/onboarding/onboarding-styles";

export default function PrivacyRoute() {
	return (
		<Screen padded centered contentContainerStyle={styles.container}>
			<AppText variant="display" style={styles.title}>
				Your data stays on your phone
			</AppText>
			<AppText color="muted" style={styles.body}>
				Everything you write is stored on this device and nowhere else. We
				cannot read it, because we never have it.
			</AppText>
			<AppText color="muted" style={styles.body}>
				Works offline, on a plane, in a tunnel, with no signal at all.
			</AppText>
			<AppText color="muted" style={styles.body}>
				Health data you choose to import is read directly from Apple Health or
				Health Connect and stays on this device. It is never sent to bro's
				servers.
			</AppText>
			<Button
				label="Continue"
				style={styles.primaryButton}
				onPress={() => router.push("/onboarding/start")}
			/>
		</Screen>
	);
}
