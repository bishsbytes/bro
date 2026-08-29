import { localTimeOf } from "@bro/domain";
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
	createDrinksStore,
	type DrinkDaySnapshot,
	type DrinksStore,
	type PresentedDrinkEntry,
} from "../../drinks/drinks-store";
import { upperCaseForLanguage } from "../../i18n";
import { StyleSheet } from "../../theme/unistyles";

type DrinkDayScreenProps = {
	localDay: string;
	store?: Pick<DrinksStore, "loadDay" | "updateEntry" | "deleteEntry">;
};

function EntryEditor({
	presented,
	busy,
	onSave,
	onDelete,
}: {
	presented: PresentedDrinkEntry;
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
	const { t } = useTranslation("drinks");
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
				<FormField
					label={t("day.dateField")}
					value={localDay}
					onChangeText={setLocalDay}
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

export function DrinkDayScreen({ localDay, store }: DrinkDayScreenProps) {
	const { t } = useTranslation(["drinks", "common"]);
	const drinks = useMemo(() => store ?? createDrinksStore(), [store]);
	const [snapshot, setSnapshot] = useState<DrinkDaySnapshot | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setSnapshot(await drinks.loadDay(localDay));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [drinks, localDay]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	async function mutate(work: () => Promise<unknown>) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await drinks.loadDay(localDay));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
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
					title={t("day.notFound")}
					body={error ?? t("day.notFoundBody")}
					actionLabel={t("day.back")}
					onAction={() => router.replace("/drinks" as Href)}
				/>
			</Screen>
		);
	}

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
					onAction={() => router.replace("/drinks" as Href)}
				/>
			) : (
				snapshot.entries.map((presented) => (
					<EntryEditor
						key={`${presented.entry.id}:${presented.entry.updatedAt}`}
						presented={presented}
						busy={busy}
						onSave={(edit) =>
							void mutate(() => drinks.updateEntry(presented.entry.id, edit))
						}
						onDelete={() =>
							void mutate(() => drinks.deleteEntry(presented.entry.id))
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
