import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
	createDrinksStore,
	type DrinkSettingsSnapshot,
	type DrinksStore,
} from "../../drinks/drinks-store";
import { StyleSheet } from "../../theme/unistyles";

type DrinksSettingsScreenProps = {
	store?: Pick<DrinksStore, "loadSettings" | "setTracked" | "setUnit">;
};

export function DrinksSettingsScreen({ store }: DrinksSettingsScreenProps) {
	const drinks = useMemo(() => store ?? createDrinksStore(), [store]);
	const [snapshot, setSnapshot] = useState<DrinkSettingsSnapshot | null>(null);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setSnapshot(await drinks.loadSettings());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [drinks]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	async function mutate(
		key: string,
		work: () => Promise<DrinkSettingsSnapshot>,
	) {
		setBusyKey(key);
		setError(null);
		try {
			setSnapshot(await work());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusyKey(null);
		}
	}

	if (!snapshot && !error) {
		return (
			<Screen centered>
				<LoadingIndicator size="large" />
			</Screen>
		);
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title="Drink settings could not be loaded"
					body={error ?? "Try again."}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">
				Choose which daily drink totals appear in Trends. Logging remains
				available whichever metrics you track.
			</AppText>
			<Button
				label="Open drink log"
				variant="secondary"
				onPress={() => router.push("/drinks" as Href)}
			/>
			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader title="Trends and goals" />
				{snapshot.metrics.map((metric) => (
					<Card key={metric.metricSlug} style={styles.row}>
						<View style={styles.grow}>
							<AppText variant="label">{metric.label}</AppText>
							<AppText variant="caption" color="muted">
								Daily total from your logged drinks
							</AppText>
						</View>
						<ThemedSwitch
							accessibilityLabel={`${metric.tracked ? "Stop tracking" : "Track"} ${metric.label}`}
							value={metric.tracked}
							disabled={busyKey !== null}
							onValueChange={(enabled) =>
								void mutate(metric.metricSlug, () =>
									drinks.setTracked(metric.metricSlug, enabled),
								)
							}
						/>
					</Card>
				))}
			</View>

			<View style={styles.section}>
				<SectionHeader title="Display units" />
				{snapshot.units.map((setting) => (
					<Card key={setting.dimension} style={styles.section}>
						<AppText variant="section">{setting.title}</AppText>
						<AppText color="muted">Example: {setting.preview}</AppText>
						<View style={styles.options}>
							{setting.options.map((option) => {
								const selected = setting.explicitUnit === option.unit;
								return (
									<Button
										key={option.unit}
										label={option.label}
										accessibilityLabel={`Use ${option.label} for ${setting.title}`}
										accessibilityState={{ selected }}
										variant={selected ? "primary" : "secondary"}
										disabled={busyKey !== null}
										onPress={() =>
											void mutate(setting.dimension, () =>
												drinks.setUnit(setting.dimension, option.unit),
											)
										}
									/>
								);
							})}
						</View>
					</Card>
				))}
			</View>
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
	grow: { flex: 1, gap: theme.spacing.xs },
	options: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
}));
