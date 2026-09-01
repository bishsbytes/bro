import { type Href, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { OptionSheet } from "../../components/option-sheet";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { ThemedSwitch } from "../../components/themed-switch";
import {
	createDrinksStore,
	type DrinkSettingsSnapshot,
	type DrinksStore,
	type DrinkUnitSetting,
} from "../../drinks/drinks-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

function resolvedLabel(setting: DrinkUnitSetting): string {
	return (
		setting.options.find((option) => option.unit === setting.resolvedUnit)
			?.label ?? setting.resolvedUnit
	);
}

type DrinksSettingsScreenProps = {
	store?: Pick<DrinksStore, "loadSettings" | "setTracked" | "setUnit">;
};

export function DrinksSettingsScreen({ store }: DrinksSettingsScreenProps) {
	const { t } = useTranslation(["settings", "common"]);
	const drinks = useMemo(() => store ?? createDrinksStore(), [store]);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [editingUnit, setEditingUnit] = useState<string | null>(null);
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(useCallback(() => drinks.loadSettings(), [drinks]));

	async function mutate(
		key: string,
		work: () => Promise<DrinkSettingsSnapshot>,
	) {
		setBusyKey(key);
		setError(null);
		try {
			setSnapshot(await work());
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
					title={t("drinks.loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const editingSetting =
		snapshot.units.find((setting) => setting.dimension === editingUnit) ?? null;

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("drinks.intro")}</AppText>
			<Button
				label={t("drinks.openLog")}
				variant="secondary"
				onPress={() => router.push("/drinks" as Href)}
			/>
			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader title={t("drinks.trendsTitle")} />
				{snapshot.metrics.map((metric) => (
					<Card key={metric.metricSlug} style={styles.row}>
						<View style={styles.grow}>
							<AppText variant="label">{metric.label}</AppText>
							<AppText variant="caption" color="muted">
								{t("drinks.metricDetail")}
							</AppText>
						</View>
						<ThemedSwitch
							accessibilityLabel={
								metric.tracked
									? t("drinks.stopTracking", { name: metric.label })
									: t("drinks.track", { name: metric.label })
							}
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
				<SectionHeader title={t("drinks.unitsTitle")} />
				{snapshot.units.map((setting) => (
					<ListRow
						key={setting.dimension}
						title={setting.title}
						value={resolvedLabel(setting)}
						detail={t("drinks.example", { value: setting.preview })}
						accessibilityLabel={t("drinks.unitA11y", {
							setting: setting.title,
						})}
						disabled={busyKey !== null}
						onPress={() => setEditingUnit(setting.dimension)}
					/>
				))}
			</View>

			{editingSetting ? (
				<OptionSheet
					visible
					title={editingSetting.title}
					intro={t("drinks.example", { value: editingSetting.preview })}
					closeAccessibilityLabel={t("drinks.unitDismissA11y", {
						setting: editingSetting.title,
					})}
					options={editingSetting.options.map((option) => ({
						value: option.unit,
						label: option.label,
						accessibilityLabel: t("drinks.useUnit", {
							unit: option.label,
							setting: editingSetting.title,
						}),
					}))}
					selected={editingSetting.explicitUnit}
					disabled={busyKey !== null}
					onSelect={(unit) =>
						void mutate(editingSetting.dimension, () =>
							drinks.setUnit(editingSetting.dimension, unit),
						)
					}
					onClose={() => setEditingUnit(null)}
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
	grow: { flex: 1, gap: theme.spacing.xs },
}));
