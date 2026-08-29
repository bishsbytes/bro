import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { StyleSheet } from "../../theme/unistyles";

export function PrivacyContent() {
	const { t } = useTranslation("privacy");

	return (
		<View style={styles.content}>
			<AppText variant="display">{t("title")}</AppText>

			<View style={styles.section}>
				<AppText variant="label">{t("device.heading")}</AppText>
				<AppText color="muted">{t("device.records")}</AppText>
				<AppText color="muted">{t("device.backup")}</AppText>
			</View>

			<View style={styles.section}>
				<AppText variant="label">{t("foodSearch.heading")}</AppText>
				<AppText color="muted">{t("foodSearch.body")}</AppText>
			</View>

			<View style={styles.section}>
				<AppText variant="label">{t("sync.heading")}</AppText>
				<AppText color="muted">{t("sync.body")}</AppText>
			</View>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.xl },
	section: { gap: theme.spacing.sm },
}));
