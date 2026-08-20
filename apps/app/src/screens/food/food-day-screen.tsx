import { localTimeOf } from "@bro/domain";
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { LoadingIndicator } from "../../components/loading-indicator";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createFoodStore,
	type FoodDaySnapshot,
	type FoodStore,
	type PresentedFoodEntry,
} from "../../food/food-store";
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
	const { entry } = presented;
	const [label, setLabel] = useState(entry.label);
	const [servingLabel, setServingLabel] = useState(entry.servingLabel ?? "");
	const [quantity, setQuantity] = useState(String(entry.quantity));
	const [localDay, setLocalDay] = useState(entry.localDay);
	const [time, setTime] = useState(localTimeOf(entry.occurredAt));
	return (
		<Card style={styles.section}>
			<FormField label="Food name" value={label} onChangeText={setLabel} />
			<FormField
				label="Serving"
				value={servingLabel}
				onChangeText={setServingLabel}
			/>
			<View style={styles.row}>
				<FormField
					label="Quantity"
					value={quantity}
					onChangeText={setQuantity}
					keyboardType="decimal-pad"
					containerStyle={styles.grow}
				/>
				<FormField
					label="Date"
					value={localDay}
					onChangeText={setLocalDay}
					containerStyle={styles.grow}
				/>
				<FormField
					label="Time"
					value={time}
					onChangeText={setTime}
					containerStyle={styles.grow}
				/>
			</View>
			{presented.contributions ? (
				<AppText variant="caption" color="muted">
					Stored snapshot: {presented.contributions}
				</AppText>
			) : null}
			<View style={styles.row}>
				<Button
					label="Save changes"
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
					label="Delete food"
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
	const food = useMemo(() => store ?? createFoodStore(), [store]);
	const [snapshot, setSnapshot] = useState<FoodDaySnapshot | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const load = useCallback(async () => {
		setError(null);
		try {
			setSnapshot(await food.loadDay(localDay));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [food, localDay]);
	useFocusEffect(useCallback(() => void load(), [load]));
	async function mutate(work: () => Promise<unknown>) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await food.loadDay(localDay));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
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
					title="Food day not found"
					body={error ?? "This day could not be loaded."}
					actionLabel="Back to food"
					onAction={() => router.replace("/food" as Href)}
				/>
			</Screen>
		);
	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			<Card style={styles.section}>
				<SectionHeader title={snapshot.localDay} eyebrow="DAY TOTALS" />
				<View style={styles.totals}>
					{snapshot.metrics.map((metric) => (
						<View key={metric.metric.slug} style={styles.total}>
							<AppText variant="micro" color="subtle">
								{metric.metric.label.toUpperCase()}
							</AppText>
							<AppText variant="section">{metric.dayFormatted ?? "—"}</AppText>
						</View>
					))}
				</View>
			</Card>
			{error ? <AppText color="danger">{error}</AppText> : null}
			{snapshot.entries.length === 0 ? (
				<EmptyState
					title="No food on this day"
					body="Deleted entries disappear from totals, trends, and goals immediately."
					actionLabel="Back to food"
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
