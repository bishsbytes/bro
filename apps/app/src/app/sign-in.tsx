import { router, useLocalSearchParams } from "expo-router";
import { leaveSettingsFlow } from "../navigation/settings-flow";
import { useDeviceSettings } from "../providers/device-settings-provider";
import { SignInScreen } from "../screens/auth/sign-in-screen";

export default function SignInRoute() {
	const { settings, completeOnboarding } = useDeviceSettings();
	const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

	const onSuccess = () => {
		if (!settings.onboardingComplete) {
			completeOnboarding();
		}
		leaveSettingsFlow(returnTo, settings.onboardingComplete);
	};

	return (
		<SignInScreen
			onShowSignUp={
				settings.onboardingComplete
					? () =>
							router.push({
								pathname: "/sign-up",
								params: returnTo ? { returnTo } : undefined,
							})
					: undefined
			}
			onSuccess={onSuccess}
		/>
	);
}
