import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, View } from "react-native";
import { AppText } from "./app-text";
import { ListRow } from "./list-row";

/** Link to the publisher's maintained guidance; bro does not generate crisis advice. */
export function SupportLink() {
	const { t } = useTranslation("common");
	const [failed, setFailed] = useState(false);
	async function open() {
		setFailed(false);
		try {
			await Linking.openURL(
				"https://www.nhs.uk/nhs-services/mental-health-services/where-to-get-urgent-help-for-mental-health/",
			);
		} catch {
			setFailed(true);
		}
	}
	return (
		<View>
			<ListRow
				title={t("support.title")}
				detail={t("support.detail")}
				accessibilityLabel={t("support.title")}
				onPress={() => void open()}
			/>
			{failed ? <AppText>{t("support.failed")}</AppText> : null}
		</View>
	);
}
