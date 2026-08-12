import { router } from "expo-router";
import { useDeviceSettings } from "../providers/device-settings-provider";
import { SignUpScreen } from "../screens/sign-up-screen";

export default function SignUpRoute() {
	const { settings, completeOnboarding } = useDeviceSettings();

	const onSuccess = async () => {
		if (!settings.onboardingComplete) {
			await completeOnboarding();
		}
		router.replace("/");
	};

	return (
		<SignUpScreen
			onShowSignIn={() => router.replace("/sign-in")}
			onSuccess={onSuccess}
		/>
	);
}
