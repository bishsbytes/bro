import { parseCheckInExport } from "@bro/logic";
import { File } from "expo-file-system";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { TextAction } from "../../components/text-action";
import { ThemedSwitch } from "../../components/themed-switch";
import { createExportStore, type ExportStore } from "../../export/export-store";
import {
	type ExportShareResult,
	exportFileName,
	shareExport,
} from "../../export/share-export";
import { toMessage } from "../../lib/errors";
import {
	refreshReminderNotifications,
	reportReminderRefreshFailure,
} from "../../reminders/reminder-materialiser";
import { StyleSheet } from "../../theme/unistyles";

type ExportScreenProps = {
	store?: Pick<ExportStore, "serialize"> &
		Partial<Pick<ExportStore, "restore">>;
	share?: (payload: string, fileName: string) => Promise<ExportShareResult>;
};

export function ExportScreen({
	store,
	share = shareExport,
}: ExportScreenProps) {
	const { t } = useTranslation("settings");
	const exporter = useMemo(() => store ?? createExportStore(), [store]);
	const [restorePayload, setRestorePayload] = useState<string | null>(null);
	const [restorePreview, setRestorePreview] = useState<string | null>(null);
	const [includeSensitive, setIncludeSensitive] = useState(false);
	const [includeNotes, setIncludeNotes] = useState(false);
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function exportData() {
		setBusy(true);
		setError(null);
		setResult(null);
		try {
			const payload = await exporter.serialize(includeSensitive, includeNotes);
			const shared = await share(payload, exportFileName());
			setResult(shared.message);
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	async function chooseRestore() {
		setBusy(true);
		setError(null);
		setRestorePayload(null);
		setRestorePreview(null);
		try {
			const selected = await File.pickFileAsync({
				mimeTypes: ["application/json", "text/plain"],
			});
			if (selected.canceled) return;
			if (selected.result.size > 50 * 1024 * 1024)
				throw new Error(t("export.restoreTooLarge"));
			const payload = await selected.result.text();
			const parsed = parseCheckInExport(payload);
			setRestorePreview(
				t("export.restorePreview", {
					date: parsed.metadata.exportedAt,
					notes: parsed.dayNotes.length,
					readings: parsed.observations.length,
				}),
			);
			setRestorePayload(payload);
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}
	async function restore() {
		if (!restorePayload || !exporter.restore) return;
		setBusy(true);
		setError(null);
		try {
			await exporter.restore(restorePayload);
			await refreshReminderNotifications().catch(reportReminderRefreshFailure);
			setRestorePayload(null);
			setRestorePreview(null);
			setResult(t("export.restored"));
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("export.intro")}</AppText>

			<Card style={styles.card}>
				<SectionHeader title={t("export.title")} />
				<View style={styles.toggleRow}>
					<View style={styles.toggleCopy}>
						<AppText variant="label">{t("export.includeSensitive")}</AppText>
						<AppText variant="caption" color="muted">
							{t("export.includeSensitiveDetail")}
						</AppText>
					</View>
					<ThemedSwitch
						accessibilityLabel={t("export.includeSensitive")}
						value={includeSensitive}
						disabled={busy}
						onValueChange={setIncludeSensitive}
					/>
				</View>
				<View style={styles.toggleRow}>
					<View style={styles.toggleCopy}>
						<AppText variant="label">{t("export.includeNotes")}</AppText>
						<AppText variant="caption" color="muted">
							{t("export.includeNotesDetail")}
						</AppText>
					</View>
					<ThemedSwitch
						accessibilityLabel={t("export.includeNotes")}
						value={includeNotes}
						disabled={busy}
						onValueChange={setIncludeNotes}
					/>
				</View>
				<AppText variant="caption" color="muted">
					{t("export.reviewContents")}
				</AppText>
			</Card>

			{result ? <AppText>{result}</AppText> : null}
			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label={t("export.share")}
				loading={busy}
				onPress={() => void exportData()}
			/>
			<Card style={styles.card}>
				<SectionHeader title={t("export.restoreTitle")} />
				<AppText color="muted">{t("export.restoreDetail")}</AppText>
				<Button
					label={t("export.chooseRestore")}
					variant="secondary"
					disabled={busy}
					onPress={() => void chooseRestore()}
				/>
				{restorePayload ? (
					<>
						<AppText>{restorePreview}</AppText>
						<Button
							label={t("export.confirmRestore")}
							loading={busy}
							onPress={() => void restore()}
						/>
						<Button
							label={t("account.cancel")}
							variant="text"
							disabled={busy}
							onPress={() => {
								setRestorePayload(null);
								setRestorePreview(null);
							}}
						/>
					</>
				) : null}
			</Card>
			<TextAction
				label={t("localData.backToToday")}
				disabled={busy}
				onPress={() => router.replace("/")}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	card: { gap: theme.spacing.md },
	toggleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.lg,
	},
	toggleCopy: { flex: 1, gap: theme.spacing.xs },
}));
