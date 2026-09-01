import { type Href, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { ThemedSwitch } from "../../components/themed-switch";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	createNicotineStore,
	type NicotineStore,
} from "../../substances/nicotine";
import { StyleSheet } from "../../theme/unistyles";

type NicotineSettingsScreenProps = {
	store?: Pick<NicotineStore, "loadSettings" | "setTracked">;
};

/**
 * Where the smoking log is switched on. It is found rather than promoted:
 * nothing elsewhere invites a non-smoker in, and turning it off returns every
 * surface to exactly what someone who never opted in sees.
 */
export function NicotineSettingsScreen({ store }: NicotineSettingsScreenProps) {
	const { t } = useTranslation(["nicotine", "settings", "common"]);
	const nicotine = useMemo(() => store ?? createNicotineStore(), [store]);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(useCallback(() => nicotine.loadSettings(), [nicotine]));

	async function setTracked(metricSlug: string, enabled: boolean) {
		setBusyKey(metricSlug);
		setError(null);
		try {
			setSnapshot(await nicotine.setTracked(metricSlug, enabled));
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusyKey(null);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("nicotine:loadFailed")}
					body={error ?? t("nicotine:loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const tracked = snapshot.metrics.some((metric) => metric.tracked);

	return (
		<Screen scroll padded gap="lg">
			{error ? <AppText color="danger">{error}</AppText> : null}
			<View style={styles.section}>
				<SectionHeader title={t("nicotine:settings.trackTitle")} />
				{snapshot.metrics.map((metric) => (
					<Card key={metric.metricSlug} style={styles.row}>
						<View style={styles.grow}>
							<AppText variant="label">{metric.label}</AppText>
							<AppText variant="caption" color="muted">
								{t("nicotine:settings.trackDetail")}
							</AppText>
						</View>
						<ThemedSwitch
							value={metric.tracked}
							disabled={busyKey === metric.metricSlug}
							accessibilityLabel={metric.label}
							onValueChange={(next) => void setTracked(metric.metricSlug, next)}
						/>
					</Card>
				))}
			</View>
			{tracked ? (
				<Button
					label={t("nicotine:title")}
					variant="secondary"
					onPress={() => router.push("/nicotine" as Href)}
				/>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
	grow: { flex: 1 },
}));
