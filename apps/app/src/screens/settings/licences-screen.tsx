import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { StyleSheet } from "../../theme/unistyles";

export function LicencesScreen() {
	const { t } = useTranslation("settings");

	return (
		<Screen scroll padded gap="lg">
			<Card style={styles.section}>
				<SectionHeader
					title={t("licences.title")}
					eyebrow={t("licences.eyebrow")}
				/>
				<View style={styles.section}>
					<AppText color="muted">{t("licences.provider")}</AppText>
					<AppText color="muted">{t("licences.licence")}</AppText>
					<AppText variant="caption" color="subtle">
						{t("licences.attribution")}
					</AppText>
				</View>
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
}));
