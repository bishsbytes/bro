import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { StyleSheet } from "../../theme/unistyles";
import {
	createUnitSettingsStore,
	type UnitSettingsSnapshot,
	type UnitSettingsStore,
} from "../../units/unit-settings-store";

type UnitsScreenProps = {
	store?: Pick<UnitSettingsStore, "load" | "set">;
};

function resolvedLabel(
	setting: UnitSettingsSnapshot["settings"][number],
): string {
	return (
		setting.options.find((option) => option.unit === setting.resolvedUnit)
			?.label ?? setting.resolvedUnit
	);
}

export function UnitsScreen({ store }: UnitsScreenProps) {
	const unitsStore = useMemo(() => store ?? createUnitSettingsStore(), [store]);
	const [snapshot, setSnapshot] = useState<UnitSettingsSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busyDimension, setBusyDimension] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			setError(null);
			setSnapshot(await unitsStore.load());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [unitsStore]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	async function choose(
		dimension: UnitSettingsSnapshot["settings"][number]["dimension"],
		unit: string,
	) {
		setBusyDimension(dimension);
		setError(null);
		try {
			setSnapshot(await unitsStore.set(dimension, unit));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusyDimension(null);
		}
	}

	if (!snapshot && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">
				Choose how measurements appear. Stored values stay unchanged, so
				switching units never changes your history or goals.
			</AppText>

			{error ? (
				<EmptyState
					title="Units could not be updated"
					body={error}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			) : null}

			{snapshot?.settings.map((setting) => (
				<Card key={setting.dimension} style={styles.setting}>
					<SectionHeader title={setting.title} />
					<AppText color="muted">{setting.description}</AppText>
					<AppText variant="label">Example: {setting.preview}</AppText>
					{setting.resolutionSource === "locale" ? (
						<AppText color="muted">
							Device default: {resolvedLabel(setting)}. Choose an option to
							override it.
						</AppText>
					) : null}
					{setting.resolutionSource === "fallback" ? (
						<AppText color="muted">
							A saved unit is no longer supported. Using{" "}
							{resolvedLabel(setting)}
							until you choose another.
						</AppText>
					) : null}
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
									disabled={busyDimension === setting.dimension}
									style={styles.option}
									onPress={() => void choose(setting.dimension, option.unit)}
								/>
							);
						})}
					</View>
				</Card>
			))}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	setting: { gap: theme.spacing.md },
	options: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: theme.spacing.sm,
	},
	option: { flexGrow: 1 },
}));
