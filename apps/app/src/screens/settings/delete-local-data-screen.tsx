import { deleteLocalProductData } from "@bro/database-app";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { toMessage } from "../../lib/errors";
import { cancelAllReminderNotifications } from "../../reminders/reminder-materialiser";
import { StyleSheet } from "../../theme/unistyles";

type DeleteLocalDataScreenProps = {
	deleteProductData?: () => Promise<void>;
	cancelReminderNotifications?: () => Promise<unknown>;
};

type DeleteStep = "idle" | "confirm" | "complete";

export function DeleteLocalDataScreen({
	deleteProductData = deleteLocalProductData,
	cancelReminderNotifications = cancelAllReminderNotifications,
}: DeleteLocalDataScreenProps) {
	const { t } = useTranslation("settings");
	const [deleteStep, setDeleteStep] = useState<DeleteStep>("idle");
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function confirmDelete() {
		if (deleting) return;

		setDeleting(true);
		setError(null);
		try {
			await deleteProductData();
			await cancelReminderNotifications();
			setDeleteStep("complete");
		} catch (caught) {
			setError(toMessage(caught, t("localData.failed")));
		} finally {
			setDeleting(false);
		}
	}

	return (
		<Screen scroll padded>
			<Card style={styles.section}>
				<SectionHeader title={t("localData.title")} />
				{deleteStep === "idle" ? (
					<>
						<AppText color="muted">{t("localData.intro")}</AppText>
						<Button
							label={t("localData.delete")}
							variant="secondary"
							tone="danger"
							onPress={() => {
								setError(null);
								setDeleteStep("confirm");
							}}
						/>
					</>
				) : null}

				{deleteStep === "confirm" ? (
					<View style={styles.confirmation}>
						<AppText variant="score" color="danger">
							{t("localData.confirmTitle")}
						</AppText>
						<AppText color="muted">{t("localData.confirmBody")}</AppText>
						{error ? <AppText color="danger">{error}</AppText> : null}
						<Button
							label={t("localData.confirmAction")}
							variant="danger"
							loading={deleting}
							onPress={() => void confirmDelete()}
						/>
						<Button
							label={t("localData.cancel")}
							variant="text"
							disabled={deleting}
							onPress={() => {
								setError(null);
								setDeleteStep("idle");
							}}
						/>
					</View>
				) : null}

				{deleteStep === "complete" ? (
					<View style={styles.confirmation}>
						<SectionHeader title={t("localData.doneTitle")} />
						<AppText color="muted">{t("localData.doneBody")}</AppText>
						<Button
							label={t("localData.backToToday")}
							onPress={() => router.replace("/")}
						/>
					</View>
				) : null}
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	confirmation: { gap: theme.spacing.md },
}));
