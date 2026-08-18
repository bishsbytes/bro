import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createHealthSettingsStore,
	type HealthSettingsSnapshot,
	type HealthSettingsStore,
} from "../../health/health-settings-store";
import { StyleSheet } from "../../theme/unistyles";

type HealthSettingsScreenProps = {
	store?: Pick<
		HealthSettingsStore,
		"load" | "connect" | "refresh" | "disconnect" | "openSettings"
	>;
};

function importedAtLabel(timestamp: number | null): string {
	if (timestamp === null) return "Waiting for first import";
	return `Last imported ${new Date(timestamp).toLocaleString()}`;
}

export function HealthSettingsScreen({ store }: HealthSettingsScreenProps) {
	const health = useMemo(() => store ?? createHealthSettingsStore(), [store]);
	const [snapshot, setSnapshot] = useState<HealthSettingsSnapshot | null>(null);
	const [busy, setBusy] = useState<
		"connect" | "refresh" | "disconnect" | "settings" | null
	>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setSnapshot(await health.load());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [health]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	async function run(
		action: Exclude<typeof busy, null>,
		work: () => Promise<HealthSettingsSnapshot | void>,
	) {
		if (busy) return;
		setBusy(action);
		setError(null);
		try {
			const next = await work();
			if (next) setSnapshot(next);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(null);
		}
	}

	if (!snapshot && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title="Health data could not be loaded"
					body={error ?? "Try again."}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	if (!snapshot.availability.available) {
		return (
			<Screen padded gap="lg">
				<EmptyState
					title={`${snapshot.platformLabel} is unavailable`}
					body={snapshot.availability.reason}
				/>
				{snapshot.connected ? (
					<>
						<Button
							label={`Manage access in ${snapshot.platformLabel}`}
							variant="secondary"
							loading={busy === "settings"}
							disabled={busy !== null && busy !== "settings"}
							onPress={() => void run("settings", () => health.openSettings())}
						/>
						<Button
							label={`Disconnect ${snapshot.platformLabel}`}
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
					eyebrow="ON THIS DEVICE"
				/>
				<AppText color="muted">
					Import sleep, steps, resting heart rate, weight, and body fat to see
					them beside your check-ins and body measurements.
				</AppText>
				<AppText variant="caption" color="subtle">
					Health data is read directly from your phone and stays on this device.
					Bro never sends it to a server.
				</AppText>
				{!snapshot.connected ? (
					<Button
						label={`Connect ${snapshot.platformLabel}`}
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
						<SectionHeader title="Connected data" />
						{connectedMetrics.map((metric) => (
							<Card key={metric.metricSlug} style={styles.metricRow}>
								<AppText variant="label">{metric.label}</AppText>
								<AppText variant="caption" color="muted">
									{importedAtLabel(metric.lastImportedAt)}
								</AppText>
							</Card>
						))}
						{snapshot.platform === "healthkit" ? (
							<AppText variant="caption" color="subtle">
								Apple Health does not reveal which data types you allowed.
								Anything you declined simply stays empty here.
							</AppText>
						) : null}
					</View>
					<View style={styles.section}>
						<Button
							label="Refresh health data"
							variant="secondary"
							loading={busy === "refresh"}
							disabled={busy !== null && busy !== "refresh"}
							onPress={() => void run("refresh", () => health.refresh())}
						/>
						<Button
							label={`Manage access in ${snapshot.platformLabel}`}
							variant="text"
							loading={busy === "settings"}
							disabled={busy !== null && busy !== "settings"}
							onPress={() => void run("settings", () => health.openSettings())}
						/>
					</View>
					<Card style={styles.card}>
						<SectionHeader title="Disconnect" />
						<AppText color="muted">
							Disconnecting stops future imports. Data already imported stays in
							bro. Revoke the phone's permission in {snapshot.platformLabel}{" "}
							settings.
						</AppText>
						<Button
							label={`Disconnect ${snapshot.platformLabel}`}
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
