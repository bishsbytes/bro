import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FullScreen as Screen } from "../../components/screen";
import { useDeviceSettings } from "../../providers/device-settings-provider";
import { onboardingStyles as styles } from "../../screens/onboarding/onboarding-styles";

export default function StartRoute() {
	const { t } = useTranslation("onboarding");
	const { completeOnboarding } = useDeviceSettings();

	const start = () => {
		completeOnboarding();
		router.replace("/");
	};

	return (
		<Screen padded centered>
			<AppText variant="display" style={styles.title}>
				{t("start.title")}
			</AppText>
			<AppText color="muted" style={styles.body}>
				{t("start.body")}
			</AppText>
			<AppText color="muted" style={styles.body}>
				{t("start.accountNote")}
			</AppText>
			<Button
				label={t("start.action")}
				style={styles.primaryButton}
				onPress={start}
			/>
			<Button
				label={t("start.haveAccount")}
				variant="text"
				style={styles.secondaryButton}
				onPress={() => router.push("/sign-in")}
			/>
		</Screen>
	);
}
