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
	createIntakeSettingsStore,
	type IntakeSettingsSnapshot,
	type IntakeSettingsStore,
	type IntakeTrackedSetting,
	type IntakeUnitSetting,
} from "../../intake/intake-settings-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type IntakeSettingsScreenProps = {
	store?: Pick<
		IntakeSettingsStore,
		"loadSettings" | "setStreamEnabled" | "setTracked" | "setUnit"
	>;
};

function resolvedLabel(setting: IntakeUnitSetting): string {
	return (
		setting.options.find((option) => option.unit === setting.resolvedUnit)
			?.label ?? setting.resolvedUnit
	);
}

function TrackedRow({
	row,
	busy,
	onChange,
}: {
	row: IntakeTrackedSetting;
	busy: boolean;
	onChange: (enabled: boolean) => void;
}) {
	const { t } = useTranslation("intake");
	return (
		<Card style={styles.row}>
			<View style={styles.grow}>
				<AppText variant="label">{row.label}</AppText>
				<AppText variant="caption" color="muted">
					{t("settings.metricDetail")}
				</AppText>
			</View>
			<ThemedSwitch
				accessibilityLabel={
					row.tracked
						? t("settings.stopTracking", { name: row.label })
						: t("settings.track", { name: row.label })
				}
				value={row.tracked}
				disabled={busy}
				onValueChange={onChange}
			/>
		</Card>
	);
}

/**
 * Where the optional streams are switched on, where totals are chosen, and
 * where their units live. Streams are found rather than promoted: nothing
 * elsewhere invites a non-smoker in, and turning one off returns every surface
 * to exactly what someone who never opted in sees.
 */
export function IntakeSettingsScreen({ store }: IntakeSettingsScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const settings = useMemo(() => store ?? createIntakeSettingsStore(), [store]);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [editingUnit, setEditingUnit] = useState<string | null>(null);
	const [showMore, setShowMore] = useState(false);
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(useCallback(() => settings.loadSettings(), [settings]));

	async function mutate(
		key: string,
		work: () => Promise<IntakeSettingsSnapshot>,
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
					title={t("intake:settings.loadFailed")}
					body={error ?? t("intake:loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const editingSetting =
		snapshot.units.find((setting) => setting.dimension === editingUnit) ?? null;
	const busy = busyKey !== null;

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("intake:settings.intro")}</AppText>
			<Button
				label={t("intake:settings.openTab")}
				variant="secondary"
				onPress={() => router.push("/intake" as Href)}
			/>
			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader title={t("intake:settings.streamsTitle")} />
				<AppText variant="caption" color="muted">
					{t("intake:settings.streamsIntro")}
				</AppText>
				{snapshot.streams.map((stream) => (
					<Card key={stream.kind} style={styles.row}>
						<View style={styles.grow}>
							<AppText variant="label">{stream.label}</AppText>
							<AppText variant="caption" color="muted">
								{stream.detail}
							</AppText>
						</View>
						<ThemedSwitch
							accessibilityLabel={
								stream.enabled
									? t("intake:settings.streamOff", { name: stream.label })
									: t("intake:settings.streamOn", { name: stream.label })
							}
							value={stream.enabled}
							disabled={busy}
							onValueChange={(enabled) =>
								void mutate(stream.kind, () =>
									settings.setStreamEnabled(stream.kind, enabled),
								)
							}
						/>
					</Card>
				))}
			</View>

			<View style={styles.section}>
				<SectionHeader title={t("intake:settings.trackTitle")} />
				<AppText variant="caption" color="muted">
					{t("intake:settings.trackIntro")}
				</AppText>
				{snapshot.groups.map((group) => {
					const rows = group.rows.filter((row) => showMore || row.primary);
					if (rows.length === 0) return null;
					return (
						<View key={group.category} style={styles.section}>
							<AppText variant="caption" color="subtle">
								{group.label}
							</AppText>
							{rows.map((row) => (
								<TrackedRow
									key={row.code}
									row={row}
									busy={busy}
									onChange={(enabled) =>
										void mutate(row.metricSlug, () =>
											settings.setTracked(row.metricSlug, enabled),
										)
									}
								/>
							))}
						</View>
					);
				})}
				<Button
					label={
						showMore
							? t("intake:settings.fewerNutrients")
							: t("intake:settings.moreNutrients")
					}
					variant="text"
					onPress={() => setShowMore((current) => !current)}
				/>
				<AppText variant="caption" color="subtle">
					{t("intake:settings.estimateNote")}
				</AppText>
			</View>

			<View style={styles.section}>
				<SectionHeader title={t("intake:settings.unitsTitle")} />
				{snapshot.units.map((setting) => (
					<ListRow
						key={setting.dimension}
						title={setting.title}
						value={resolvedLabel(setting)}
						detail={t("intake:settings.example", { value: setting.preview })}
						accessibilityLabel={t("intake:settings.unitA11y", {
							setting: setting.title,
						})}
						disabled={busy}
						onPress={() => setEditingUnit(setting.dimension)}
					/>
				))}
			</View>

			{editingSetting ? (
				<OptionSheet
					visible
					title={editingSetting.title}
					closeAccessibilityLabel={t("intake:settings.unitDismissA11y", {
						setting: editingSetting.title,
					})}
					options={editingSetting.options.map((option) => ({
						value: option.unit,
						label: option.label,
						accessibilityLabel: t("intake:settings.useUnit", {
							unit: option.label,
							setting: editingSetting.title,
						}),
					}))}
					selected={editingSetting.explicitUnit}
					disabled={busy}
					onSelect={(unit) =>
						void mutate(editingSetting.dimension, () =>
							settings.setUnit(editingSetting.dimension, unit),
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
	row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
	grow: { flex: 1, gap: theme.spacing.xs },
}));
