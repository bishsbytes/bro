import { type Href, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ListRow } from "../../components/list-row";
import { StackScreen as Screen } from "../../components/screen";

export function DataSettingsScreen() {
	const { t } = useTranslation("settings");

	return (
		<Screen scroll padded gap="md">
			<ListRow
				title={t("index.privacy")}
				detail={t("index.privacyDetail")}
				accessibilityLabel={t("index.privacyA11y")}
				onPress={() => router.push("/settings/data/privacy" as Href)}
			/>
			<ListRow
				title={t("index.licences")}
				detail={t("index.licencesDetail")}
				accessibilityLabel={t("index.licencesA11y")}
				onPress={() => router.push("/settings/data/licences" as Href)}
			/>
			<ListRow
				title={t("index.export")}
				detail={t("index.exportDetail")}
				accessibilityLabel={t("index.exportA11y")}
				onPress={() => router.push("/settings/data/export" as Href)}
			/>
			<ListRow
				title={t("localData.delete")}
				detail={t("localData.intro")}
				accessibilityLabel={t("localData.deleteA11y")}
				onPress={() => router.push("/settings/data/delete" as Href)}
			/>
		</Screen>
	);
}
