import type { WeekStartDay } from "@bro/domain";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { OptionSheet } from "../../components/option-sheet";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";
import {
	createUnitSettingsStore,
	type UnitSetting,
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

const WEEK_START_DIMENSION = "week_start";

function resolvedLabel(setting: UnitSetting): string {
	return (
		setting.options.find((option) => option.unit === setting.resolvedUnit)
			?.label ?? setting.resolvedUnit
	);
}

/** Says where an unchosen unit came from, so the row's value is not a mystery. */
function inheritedNoteKey(setting: UnitSetting) {
	if (setting.resolutionSource === "locale") {
		return "units.deviceDefault" as const;
	}
	if (setting.resolutionSource === "fallback") {
		return "units.unsupportedUnit" as const;
	}
	return null;
}

export function UnitsScreen({ store }: UnitsScreenProps) {
	const { t } = useTranslation(["settings", "common"]);
	const unitsStore = useMemo(() => store ?? createUnitSettingsStore(), [store]);
	const [busyDimension, setBusyDimension] = useState<string | null>(null);
	const [editing, setEditing] = useState<string | null>(null);
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
		setBusyDimension(WEEK_START_DIMENSION);
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

	const editingSetting =
		snapshot?.settings.find((setting) => setting.dimension === editing) ?? null;
	const editingWeekStart = editing === WEEK_START_DIMENSION;
	const weekStartLabel = WEEK_START_OPTIONS.find(
		(option) => option.day === weekStart,
	)?.labelKey;
	const inheritedKey = editingSetting ? inheritedNoteKey(editingSetting) : null;

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

			<View style={styles.rows}>
				{weekStart && weekStartLabel ? (
					<ListRow
						title={t("units.weekStartTitle")}
						value={t(weekStartLabel)}
						detail={t("units.weekStartIntro")}
						accessibilityLabel={t("units.weekStartRowA11y")}
						disabled={busyDimension !== null}
						onPress={() => setEditing(WEEK_START_DIMENSION)}
					/>
				) : null}

				{snapshot?.settings.map((setting) => (
					<ListRow
						key={setting.dimension}
						title={setting.title}
						value={resolvedLabel(setting)}
						detail={t("units.example", { value: setting.preview })}
						accessibilityLabel={t("units.settingA11y", {
							setting: setting.title,
						})}
						disabled={busyDimension !== null}
						onPress={() => setEditing(setting.dimension)}
					/>
				))}
			</View>

			{editingSetting ? (
				<OptionSheet
					visible
					title={editingSetting.title}
					intro={editingSetting.description}
					note={
						inheritedKey
							? t(inheritedKey, { unit: resolvedLabel(editingSetting) })
							: undefined
					}
					closeAccessibilityLabel={t("units.dismissA11y", {
						setting: editingSetting.title,
					})}
					options={editingSetting.options.map((option) => ({
						value: option.unit,
						label: option.label,
						accessibilityLabel: t("units.useUnit", {
							unit: option.label,
							setting: editingSetting.title,
						}),
					}))}
					selected={editingSetting.explicitUnit}
					disabled={busyDimension !== null}
					onSelect={(unit) => void choose(editingSetting.dimension, unit)}
					onClose={() => setEditing(null)}
				/>
			) : null}

			{editingWeekStart && weekStart ? (
				<OptionSheet
					visible
					title={t("units.weekStartTitle")}
					intro={t("units.weekStartIntro")}
					closeAccessibilityLabel={t("units.weekStartDismissA11y")}
					options={WEEK_START_OPTIONS.map((option) => ({
						value: option.day,
						label: t(option.labelKey),
						accessibilityLabel: t("units.weekStartA11y", {
							day: t(option.labelKey),
						}),
					}))}
					selected={weekStart}
					disabled={busyDimension !== null}
					onSelect={(day) => void chooseWeekStart(day)}
					onClose={() => setEditing(null)}
				/>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	rows: { gap: theme.spacing.md },
}));
