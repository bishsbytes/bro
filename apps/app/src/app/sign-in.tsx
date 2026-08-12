import { router } from "expo-router";
import { useDeviceSettings } from "../providers/device-settings-provider";
import { SignInScreen } from "../screens/sign-in-screen";

export default function SignInRoute() {
	const { settings, completeOnboarding } = useDeviceSettings();

	const onSuccess = async () => {
		if (!settings.onboardingComplete) {
			await completeOnboarding();
		}
		router.replace("/");
	};

	return (
		<SignInScreen
			onShowSignUp={
				settings.onboardingComplete ? () => router.push("/sign-up") : undefined
			}
			onSuccess={onSuccess}
		/>
	);
}
