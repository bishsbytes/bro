import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { ThemedSwitch } from "../../components/themed-switch";
import { createExportStore, type ExportStore } from "../../export/export-store";
import {
	type ExportShareResult,
	exportFileName,
	shareExport,
} from "../../export/share-export";
import { StyleSheet } from "../../theme/unistyles";

type ExportScreenProps = {
	store?: Pick<ExportStore, "serialize">;
	share?: (payload: string, fileName: string) => Promise<ExportShareResult>;
};

export function ExportScreen({
	store,
	share = shareExport,
}: ExportScreenProps) {
	const { t } = useTranslation("settings");
	const exporter = useMemo(() => store ?? createExportStore(), [store]);
	const [includeSensitive, setIncludeSensitive] = useState(false);
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function exportData() {
		setBusy(true);
		setError(null);
		setResult(null);
		try {
			const payload = await exporter.serialize(includeSensitive);
			const shared = await share(payload, exportFileName());
			setResult(shared.message);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
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
			</Card>

			{result ? <AppText>{result}</AppText> : null}
			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label={t("export.share")}
				loading={busy}
				onPress={() => void exportData()}
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
