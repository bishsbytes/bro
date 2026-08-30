import type { WeekStartDay } from "@bro/domain";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";
import {
	createUnitSettingsStore,
	type UnitSettingsSnapshot,
	type UnitSettingsStore,
	WEEK_START_OPTIONS,
} from "../../units/unit-settings-store";

type UnitsScreenProps = {
	store?: Pick<
		UnitSettingsStore,
		"load" | "set" | "loadWeekStart" | "setWeekStart"
	>;
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
	const { t } = useTranslation(["settings", "common"]);
	const unitsStore = useMemo(() => store ?? createUnitSettingsStore(), [store]);
	const [busyDimension, setBusyDimension] = useState<string | null>(null);
	// Units and week start are separate preferences, but the screen shows them
	// as one page and has nothing to say until both have arrived.
	const { data, error, loading, reload, setData, setError } = useFocusStoreLoad(
		useCallback(async () => {
			const [snapshot, weekStart] = await Promise.all([
				unitsStore.load(),
				unitsStore.loadWeekStart(),
			]);
			return { snapshot, weekStart };
		}, [unitsStore]),
	);
	const snapshot = data?.snapshot;
	const weekStart = data?.weekStart;

	async function choose(
		dimension: UnitSettingsSnapshot["settings"][number]["dimension"],
		unit: string,
	) {
		if (!data) return;
		setBusyDimension(dimension);
		setError(null);
		try {
			setData({ ...data, snapshot: await unitsStore.set(dimension, unit) });
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusyDimension(null);
		}
	}

	async function chooseWeekStart(day: WeekStartDay) {
		if (!data) return;
		setBusyDimension("week_start");
		setError(null);
		try {
			await unitsStore.setWeekStart(day);
			setData({ ...data, weekStart: day });
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusyDimension(null);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("units.intro")}</AppText>

			{error ? (
				<EmptyState
					title={t("units.updateFailed")}
					body={error}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			) : null}

			{weekStart ? (
				<Card style={styles.setting}>
					<SectionHeader title={t("units.weekStartTitle")} />
					<AppText color="muted">{t("units.weekStartIntro")}</AppText>
					<View style={styles.options}>
						{WEEK_START_OPTIONS.map((option) => {
							const selected = weekStart === option.day;
							return (
								<Button
									key={option.day}
									label={t(option.labelKey)}
									accessibilityLabel={t("units.weekStartA11y", {
										day: t(option.labelKey),
									})}
									accessibilityState={{ selected }}
									variant={selected ? "primary" : "secondary"}
									disabled={busyDimension === "week_start"}
									style={styles.option}
									onPress={() => void chooseWeekStart(option.day)}
								/>
							);
						})}
					</View>
				</Card>
			) : null}

			{snapshot?.settings.map((setting) => (
				<Card key={setting.dimension} style={styles.setting}>
					<SectionHeader title={setting.title} />
					<AppText color="muted">{setting.description}</AppText>
					<AppText variant="label">
						{t("units.example", { value: setting.preview })}
					</AppText>
					{setting.resolutionSource === "locale" ? (
						<AppText color="muted">
							{t("units.deviceDefault", { unit: resolvedLabel(setting) })}
						</AppText>
					) : null}
					{setting.resolutionSource === "fallback" ? (
						<AppText color="muted">
							{t("units.unsupportedUnit", { unit: resolvedLabel(setting) })}
						</AppText>
					) : null}
					<View style={styles.options}>
						{setting.options.map((option) => {
							const selected = setting.explicitUnit === option.unit;
							return (
								<Button
									key={option.unit}
									label={option.label}
									accessibilityLabel={t("units.useUnit", {
										unit: option.label,
										setting: setting.title,
									})}
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
