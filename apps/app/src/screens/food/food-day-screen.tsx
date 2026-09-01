import { localTimeOf } from "@bro/domain";
import { type Href, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { DateField } from "../../components/date-field";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createFoodStore,
	type FoodStore,
	type PresentedFoodEntry,
} from "../../food/food-store";
import { upperCaseForLanguage } from "../../i18n";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type FoodDayScreenProps = {
	localDay: string;
	store?: Pick<FoodStore, "loadDay" | "updateEntry" | "deleteEntry">;
};

function EntryEditor({
	presented,
	busy,
	onSave,
	onDelete,
}: {
	presented: PresentedFoodEntry;
	busy: boolean;
	onSave: (edit: {
		label: string;
		servingLabel: string | null;
		quantity: number;
		localDay: string;
		time: string;
	}) => void;
	onDelete: () => void;
}) {
	const { t } = useTranslation("food");
	const { entry } = presented;
	const [label, setLabel] = useState(entry.label);
	const [servingLabel, setServingLabel] = useState(entry.servingLabel ?? "");
	const [quantity, setQuantity] = useState(String(entry.quantity));
	const [localDay, setLocalDay] = useState(entry.localDay);
	const [time, setTime] = useState(localTimeOf(entry.occurredAt));
	return (
		<Card style={styles.section}>
			<FormField
				label={t("day.nameField")}
				value={label}
				onChangeText={setLabel}
			/>
			<FormField
				label={t("day.servingField")}
				value={servingLabel}
				onChangeText={setServingLabel}
			/>
			<View style={styles.row}>
				<FormField
					label={t("day.quantityField")}
					value={quantity}
					onChangeText={setQuantity}
					keyboardType="decimal-pad"
					containerStyle={styles.grow}
				/>
				<DateField
					label={t("day.dateField")}
					value={localDay}
					onChangeDate={setLocalDay}
					containerStyle={styles.grow}
				/>
				<FormField
					label={t("day.timeField")}
					value={time}
					onChangeText={setTime}
					containerStyle={styles.grow}
				/>
			</View>
			{presented.contributions ? (
				<AppText variant="caption" color="muted">
					{t("day.storedSnapshot", { value: presented.contributions })}
				</AppText>
			) : null}
			<View style={styles.row}>
				<Button
					label={t("day.save")}
					variant="secondary"
					disabled={busy}
					style={styles.grow}
					onPress={() =>
						onSave({
							label,
							servingLabel: servingLabel.trim() || null,
							quantity: Number(quantity),
							localDay,
							time,
						})
					}
				/>
				<Button
					label={t("day.delete")}
					variant="text"
					tone="danger"
					disabled={busy}
					style={styles.grow}
					onPress={onDelete}
				/>
			</View>
		</Card>
	);
}

export function FoodDayScreen({ localDay, store }: FoodDayScreenProps) {
	const { t } = useTranslation(["food", "common"]);
	const food = useMemo(() => store ?? createFoodStore(), [store]);
	const [busy, setBusy] = useState(false);
	const {
		data: snapshot,
		error,
		loading,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(
		useCallback(() => food.loadDay(localDay), [food, localDay]),
	);

	async function mutate(work: () => Promise<unknown>) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await food.loadDay(localDay));
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}
	if (!snapshot)
		return (
			<Screen centered padded>
				<EmptyState
					title={t("day.notFound")}
					body={error ?? t("day.notFoundBody")}
					actionLabel={t("day.back")}
					onAction={() => router.replace("/food" as Href)}
				/>
			</Screen>
		);
	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			<Card style={styles.section}>
				<SectionHeader title={snapshot.localDay} eyebrow={t("day.eyebrow")} />
				<View style={styles.totals}>
					{snapshot.metrics.map((metric) => (
						<View key={metric.metric.slug} style={styles.total}>
							<AppText variant="micro" color="subtle">
								{upperCaseForLanguage(metric.metric.label)}
							</AppText>
							<AppText variant="section">
								{metric.dayFormatted ?? t("common:emDash")}
							</AppText>
						</View>
					))}
				</View>
			</Card>
			{error ? <AppText color="danger">{error}</AppText> : null}
			{snapshot.entries.length === 0 ? (
				<EmptyState
					title={t("day.emptyTitle")}
					body={t("day.emptyBody")}
					actionLabel={t("day.back")}
					onAction={() => router.replace("/food" as Href)}
				/>
			) : (
				snapshot.entries.map((presented) => (
					<EntryEditor
						key={`${presented.entry.id}:${presented.entry.updatedAt}`}
						presented={presented}
						busy={busy}
						onSave={(edit) =>
							void mutate(() => food.updateEntry(presented.entry.id, edit))
						}
						onDelete={() =>
							void mutate(() => food.deleteEntry(presented.entry.id))
						}
					/>
				))
			)}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: { flexDirection: "row", gap: theme.spacing.md },
	grow: { flex: 1 },
	totals: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
	total: { minWidth: "44%", flexGrow: 1, gap: theme.spacing.xs },
}));
