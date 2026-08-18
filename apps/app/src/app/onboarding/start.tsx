import { router } from "expo-router";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FullScreen as Screen } from "../../components/screen";
import { useDeviceSettings } from "../../providers/device-settings-provider";
import { onboardingStyles as styles } from "../../screens/onboarding/onboarding-styles";

export default function StartRoute() {
	const { completeOnboarding } = useDeviceSettings();

	const start = () => {
		completeOnboarding();
		router.replace("/");
	};

	return (
		<Screen padded centered contentContainerStyle={styles.container}>
			<AppText variant="display" style={styles.title}>
				Ready when you are
			</AppText>
			<AppText color="muted" style={styles.body}>
				Use the core app for free, for as long as you want, with no account.
			</AppText>
			<AppText color="muted" style={styles.body}>
				Later, if you want your notes on more than one device, you can add an
				account and upgrade. Up to you — the app works fully without either.
			</AppText>
			<Button
				label="Start using the app"
				style={styles.primaryButton}
				onPress={start}
			/>
			<Button
				label="I already have an account"
				variant="text"
				style={styles.secondaryButton}
				onPress={() => router.push("/sign-in")}
			/>
		</Screen>
	);
}
