import type { TFunction } from "i18next";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createHealthSettingsStore,
	type HealthSettingsSnapshot,
	type HealthSettingsStore,
} from "../../health/health-settings-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type HealthSettingsScreenProps = {
	store?: Pick<
		HealthSettingsStore,
		"load" | "connect" | "refresh" | "disconnect" | "openSettings"
	>;
};

function importedAtLabel(
	t: TFunction<"settings">,
	timestamp: number | null,
): string {
	if (timestamp === null) return t("health.waitingForImport");
	return t("health.lastImported", {
		when: new Date(timestamp).toLocaleString(),
	});
}

export function HealthSettingsScreen({ store }: HealthSettingsScreenProps) {
	const { t } = useTranslation(["settings", "common"]);
	const health = useMemo(() => store ?? createHealthSettingsStore(), [store]);
	const [busy, setBusy] = useState<
		"connect" | "refresh" | "disconnect" | "settings" | null
	>(null);
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(useCallback(() => health.load(), [health]));

	async function run(
		action: Exclude<typeof busy, null>,
		work: () => Promise<HealthSettingsSnapshot | undefined>,
	) {
		if (busy) return;
		setBusy(action);
		setError(null);
		try {
			const next = await work();
			if (next) setSnapshot(next);
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(null);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("health.loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	if (!snapshot.availability.available) {
		return (
			<Screen padded gap="lg">
				<EmptyState
					title={t("health.unavailable", {
						platform: snapshot.platformLabel,
					})}
					body={snapshot.availability.reason}
				/>
				{snapshot.connected ? (
					<>
						<Button
							label={t("health.manageAccess", {
								platform: snapshot.platformLabel,
							})}
							variant="secondary"
							loading={busy === "settings"}
							disabled={busy !== null && busy !== "settings"}
							onPress={() => void run("settings", () => health.openSettings())}
						/>
						<Button
							label={t("health.disconnectPlatform", {
								platform: snapshot.platformLabel,
							})}
							variant="text"
							tone="danger"
							loading={busy === "disconnect"}
							disabled={busy !== null && busy !== "disconnect"}
							onPress={() => void run("disconnect", () => health.disconnect())}
						/>
					</>
				) : null}
			</Screen>
		);
	}

	const connectedMetrics = snapshot.metrics.filter(
		(metric) => metric.connected,
	);

	return (
		<Screen scroll padded gap="lg">
			<Card style={styles.card}>
				<SectionHeader
					title={snapshot.platformLabel}
					eyebrow={t("health.eyebrow")}
				/>
				<AppText color="muted">{t("health.intro")}</AppText>
				<AppText variant="caption" color="subtle">
					{t("health.localNote")}
				</AppText>
				{!snapshot.connected ? (
					<Button
						label={t("health.connect", { platform: snapshot.platformLabel })}
						loading={busy === "connect"}
						disabled={busy !== null && busy !== "connect"}
						onPress={() => void run("connect", () => health.connect())}
					/>
				) : null}
			</Card>

			{error ? <AppText color="danger">{error}</AppText> : null}

			{snapshot.connected ? (
				<>
					<View style={styles.section}>
						<SectionHeader title={t("health.connectedTitle")} />
						{connectedMetrics.map((metric) => (
							<Card key={metric.metricSlug} style={styles.metricRow}>
								<AppText variant="label">{metric.label}</AppText>
								<AppText variant="caption" color="muted">
									{importedAtLabel(t, metric.lastImportedAt)}
								</AppText>
							</Card>
						))}
						{snapshot.platform === "healthkit" ? (
							<AppText variant="caption" color="subtle">
								{t("health.healthkitNote")}
							</AppText>
						) : null}
					</View>
					<View style={styles.section}>
						<Button
							label={t("health.refresh")}
							variant="secondary"
							loading={busy === "refresh"}
							disabled={busy !== null && busy !== "refresh"}
							onPress={() => void run("refresh", () => health.refresh())}
						/>
						<Button
							label={t("health.manageAccess", {
								platform: snapshot.platformLabel,
							})}
							variant="text"
							loading={busy === "settings"}
							disabled={busy !== null && busy !== "settings"}
							onPress={() => void run("settings", () => health.openSettings())}
						/>
					</View>
					<Card style={styles.card}>
						<SectionHeader title={t("health.disconnectTitle")} />
						<AppText color="muted">
							{t("health.disconnectBody", {
								platform: snapshot.platformLabel,
							})}
						</AppText>
						<Button
							label={t("health.disconnectPlatform", {
								platform: snapshot.platformLabel,
							})}
							variant="secondary"
							tone="danger"
							loading={busy === "disconnect"}
							disabled={busy !== null && busy !== "disconnect"}
							onPress={() => void run("disconnect", () => health.disconnect())}
						/>
					</Card>
				</>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	card: { gap: theme.spacing.md },
	section: { gap: theme.spacing.md },
	metricRow: { gap: theme.spacing.xs },
}));
