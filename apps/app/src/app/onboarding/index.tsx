import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FullScreen as Screen } from "../../components/screen";
import { onboardingStyles as styles } from "../../screens/onboarding/onboarding-styles";

export default function WelcomeRoute() {
	const { t } = useTranslation("onboarding");
	return (
		<Screen padded centered>
			<AppText variant="label" color="brand" style={styles.eyebrow}>
				{t("welcome.eyebrow")}
			</AppText>
			<AppText variant="display" style={styles.title}>
				{t("welcome.title")}
			</AppText>
			<AppText color="muted" style={styles.body}>
				{t("welcome.body")}
			</AppText>
			<Button
				label={t("continueAction")}
				style={styles.primaryButton}
				onPress={() => router.push("/onboarding/privacy")}
			/>
		</Screen>
	);
}
