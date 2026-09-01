import { localTimeOf } from "@bro/domain";
import type { ConsumptionDerivedMeasurementSlug } from "@bro/domain/metric-registry";
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
import { TimeField } from "../../components/time-field";
import { upperCaseForLanguage } from "../../i18n";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import type {
	PresentedSubstanceEntry,
	SubstanceDescriptor,
	SubstanceStore,
} from "../../substances/substance-store";
import { createSubstanceStore } from "../../substances/substance-store";
import { StyleSheet } from "../../theme/unistyles";

type SubstanceDayScreenProps<Slug extends ConsumptionDerivedMeasurementSlug> = {
	descriptor: SubstanceDescriptor<Slug>;
	localDay: string;
	store?: Pick<SubstanceStore<Slug>, "loadDay" | "updateEntry" | "deleteEntry">;
};

function EntryEditor({
	presented,
	busy,
	onSave,
	onDelete,
}: {
	presented: PresentedSubstanceEntry;
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
	const { t } = useTranslation("nicotine");
	const { entry } = presented;
	const [label, setLabel] = useState(entry.label);
	const [servingLabel, setServingLabel] = useState(entry.servingLabel ?? "");
	const [quantity, setQuantity] = useState(String(entry.quantity));
	const [localDay, setLocalDay] = useState(entry.localDay);
	const [time, setTime] = useState(localTimeOf(entry.occurredAt));

	return (
		<Card style={styles.section}>
			<FormField
				label={t("free.label")}
				value={label}
				onChangeText={setLabel}
			/>
			<FormField
				label={t("free.servingLabel")}
				value={servingLabel}
				onChangeText={setServingLabel}
			/>
			<View style={styles.row}>
				<FormField
					label={t("entry.quantity")}
					value={quantity}
					onChangeText={setQuantity}
					keyboardType="decimal-pad"
					containerStyle={styles.grow}
				/>
				<DateField
					label={t("entry.time")}
					value={localDay}
					onChangeDate={setLocalDay}
					containerStyle={styles.grow}
				/>
				<TimeField
					label={t("entry.time")}
					value={time}
					onChangeTime={setTime}
					containerStyle={styles.grow}
				/>
			</View>
			<View style={styles.row}>
				<Button
					label={t("entry.save")}
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
					label={t("entry.delete")}
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

/** A day's entries, editable and deletable; every total re-derives on save. */
export function SubstanceDayScreen<
	Slug extends ConsumptionDerivedMeasurementSlug,
>({ descriptor, localDay, store }: SubstanceDayScreenProps<Slug>) {
	const { t } = useTranslation("common");
	const substance = useMemo(
		() => store ?? createSubstanceStore(descriptor),
		[store, descriptor],
	);
	const [busy, setBusy] = useState(false);
	const {
		data: snapshot,
		error,
		loading,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(
		useCallback(() => substance.loadDay(localDay), [substance, localDay]),
	);

	async function mutate(work: () => Promise<unknown>) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await substance.loadDay(localDay));
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={descriptor.copy.loadFailed()}
					body={error ?? descriptor.copy.loadFailedBody()}
					onAction={() => router.replace(descriptor.routeBase as Href)}
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			<Card style={styles.section}>
				<SectionHeader
					title={snapshot.localDay}
					eyebrow={descriptor.copy.dayTotal()}
				/>
				<View style={styles.totals}>
					{snapshot.metrics.map((metric) => (
						<View key={metric.metric.slug} style={styles.total}>
							<AppText variant="micro" color="subtle">
								{upperCaseForLanguage(metric.metric.label)}
							</AppText>
							<AppText variant="section">
								{metric.dayFormatted ?? t("emDash")}
							</AppText>
						</View>
					))}
				</View>
			</Card>

			{error ? <AppText color="danger">{error}</AppText> : null}

			{snapshot.entries.length === 0 ? (
				<EmptyState
					title={descriptor.copy.dayEmpty()}
					body={descriptor.copy.dayEmptyBody()}
				/>
			) : (
				snapshot.entries.map((presented) => (
					<EntryEditor
						key={`${presented.entry.id}:${presented.entry.updatedAt}`}
						presented={presented}
						busy={busy}
						onSave={(edit) =>
							void mutate(() => substance.updateEntry(presented.entry.id, edit))
						}
						onDelete={() =>
							void mutate(() => substance.deleteEntry(presented.entry.id))
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
