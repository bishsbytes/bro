import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Switch, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createFoodStore,
	type FoodSettingsSnapshot,
	type FoodStore,
} from "../../food/food-store";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

type FoodSettingsScreenProps = {
	store?: Pick<FoodStore, "loadSettings" | "setTracked">;
};

export function FoodSettingsScreen({ store }: FoodSettingsScreenProps) {
	const food = useMemo(() => store ?? createFoodStore(), [store]);
	const { theme } = useUnistyles();
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
				<ActivityIndicator size="large" />
			</Screen>
		);
	if (!snapshot)
		return (
			<Screen centered padded>
				<EmptyState
					title="Food settings could not be loaded"
					body={error ?? "Try again."}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">
				Choose which daily nutrition totals appear in Trends. Logging remains
				available whichever metrics you track.
			</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}
			<View style={styles.section}>
				<SectionHeader title="Trends and goals" />
				{snapshot.metrics.map((metric) => (
					<Card key={metric.metricSlug} style={styles.row}>
						<View style={styles.grow}>
							<AppText variant="label">{metric.label}</AppText>
							<AppText variant="caption" color="muted">
								Daily total from food and other applicable entries
							</AppText>
						</View>
						<Switch
							accessibilityLabel={`${metric.tracked ? "Stop tracking" : "Track"} ${metric.label}`}
							value={metric.tracked}
							disabled={busyKey !== null}
							trackColor={{
								false: theme.colors.border,
								true: theme.colors.brand,
							}}
							onValueChange={(enabled) =>
								void setTracked(metric.metricSlug, enabled)
							}
						/>
					</Card>
				))}
			</View>
			<Card style={styles.section}>
				<SectionHeader title="Display units" />
				<AppText color="muted">
					Energy is shown in kcal. Protein, carbohydrate, and fat are shown in
					grams.
				</AppText>
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
	grow: { flex: 1, gap: theme.spacing.xs },
}));
