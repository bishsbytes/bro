import { useMemo, useState } from "react";
import { Switch, View } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import { createExportStore, type ExportStore } from "../export/export-store";
import {
	type ExportShareResult,
	exportFileName,
	shareExport,
} from "../export/share-export";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

type ExportScreenProps = {
	store?: Pick<ExportStore, "serialize">;
	share?: (payload: string, fileName: string) => Promise<ExportShareResult>;
};

export function ExportScreen({
	store,
	share = shareExport,
}: ExportScreenProps) {
	const exporter = useMemo(() => store ?? createExportStore(), [store]);
	const { theme } = useUnistyles();
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
			<AppText color="muted">
				This JSON file contains the record stored by bro on this device. It
				leaves only when you choose where to share or save it.
			</AppText>

			<Card style={styles.card}>
				<SectionHeader title="What to include" />
				<View style={styles.toggleRow}>
					<View style={styles.toggleCopy}>
						<AppText variant="label">Include sensitive data</AppText>
						<AppText variant="caption" color="muted">
							Includes sensitive metrics, custom habits, and sensitive life
							areas.
						</AppText>
					</View>
					<Switch
						accessibilityLabel="Include sensitive data"
						value={includeSensitive}
						disabled={busy}
						trackColor={{
							false: theme.colors.border,
							true: theme.colors.brand,
						}}
						onValueChange={setIncludeSensitive}
					/>
				</View>
			</Card>

			{result ? <AppText>{result}</AppText> : null}
			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label="Share or save export"
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
