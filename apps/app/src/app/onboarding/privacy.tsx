import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/button";
import { FullScreen as Screen } from "../../components/screen";
import { onboardingStyles as styles } from "../../screens/onboarding/onboarding-styles";
import { PrivacyContent } from "../../screens/privacy/privacy-content";

export default function PrivacyRoute() {
	const { t } = useTranslation("onboarding");
	return (
		<Screen scroll padded>
			<PrivacyContent />
			<Button
				label={t("continueAction")}
				style={styles.primaryButton}
				onPress={() => router.push("/onboarding/start")}
			/>
		</Screen>
	);
}
