import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LoadingIndicator } from "../../components/loading-indicator";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { ThemedSwitch } from "../../components/themed-switch";
import {
	createFoodStore,
	type FoodSettingsSnapshot,
	type FoodStore,
} from "../../food/food-store";
import { StyleSheet } from "../../theme/unistyles";

type FoodSettingsScreenProps = {
	store?: Pick<FoodStore, "loadSettings" | "setTracked">;
};

export function FoodSettingsScreen({ store }: FoodSettingsScreenProps) {
	const { t } = useTranslation(["settings", "common"]);
	const food = useMemo(() => store ?? createFoodStore(), [store]);
	const [snapshot, setSnapshot] = useState<FoodSettingsSnapshot | null>(null);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const load = useCallback(async () => {
		setError(null);
		try {
			setSnapshot(await food.loadSettings());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [food]);
	useFocusEffect(useCallback(() => void load(), [load]));
	async function setTracked(metricSlug: string, enabled: boolean) {
		setBusyKey(metricSlug);
		setError(null);
		try {
			setSnapshot(await food.setTracked(metricSlug, enabled));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusyKey(null);
		}
	}
	if (!snapshot && !error)
		return (
			<Screen centered>
				<LoadingIndicator size="large" />
			</Screen>
		);
	if (!snapshot)
		return (
			<Screen centered padded>
				<EmptyState
					title={t("food.loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("food.intro")}</AppText>
			<Button
				label={t("food.openLog")}
				variant="secondary"
				onPress={() => router.push("/food" as Href)}
			/>
			{error ? <AppText color="danger">{error}</AppText> : null}
			<View style={styles.section}>
				<SectionHeader title={t("food.trendsTitle")} />
				{snapshot.metrics.map((metric) => (
					<Card key={metric.metricSlug} style={styles.row}>
						<View style={styles.grow}>
							<AppText variant="label">{metric.label}</AppText>
							<AppText variant="caption" color="muted">
								{t("food.metricDetail")}
							</AppText>
						</View>
						<ThemedSwitch
							accessibilityLabel={
								metric.tracked
									? t("food.stopTracking", { name: metric.label })
									: t("food.track", { name: metric.label })
							}
							value={metric.tracked}
							disabled={busyKey !== null}
							onValueChange={(enabled) =>
								void setTracked(metric.metricSlug, enabled)
							}
						/>
					</Card>
				))}
			</View>
			<Card style={styles.section}>
				<SectionHeader title={t("food.unitsTitle")} />
				<AppText color="muted">{t("food.unitsBody")}</AppText>
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
	grow: { flex: 1, gap: theme.spacing.xs },
}));
