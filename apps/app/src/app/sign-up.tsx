import { router, useLocalSearchParams } from "expo-router";
import { leaveAccountFlow } from "../navigation/account-flow";
import { useDeviceSettings } from "../providers/device-settings-provider";
import { SignUpScreen } from "../screens/auth/sign-up-screen";

export default function SignUpRoute() {
	const { settings, completeOnboarding } = useDeviceSettings();
	const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

	const onSuccess = () => {
		if (!settings.onboardingComplete) {
			completeOnboarding();
		}
		leaveAccountFlow(returnTo, settings.onboardingComplete);
	};

	return (
		<SignUpScreen
			onShowSignIn={() =>
				router.replace({
					pathname: "/sign-in",
					params: returnTo ? { returnTo } : undefined,
				})
			}
			onSuccess={onSuccess}
		/>
	);
}
