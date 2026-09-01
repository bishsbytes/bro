import { localDayOf, localTimeOf } from "@bro/domain";
import type { ConsumptionDerivedMeasurementSlug } from "@bro/domain/metric-registry";
import type { SubstanceCatalogueEntry } from "@bro/domain/substance-catalogue";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { DateField } from "../../components/date-field";
import { FormField } from "../../components/form-field";
import { ListRow } from "../../components/list-row";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { TimeField } from "../../components/time-field";
import { toMessage } from "../../lib/errors";
import {
	createSubstanceStore,
	type SubstanceDescriptor,
	type SubstanceStore,
} from "../../substances/substance-store";
import { StyleSheet } from "../../theme/unistyles";

type SubstanceLogScreenProps<Slug extends ConsumptionDerivedMeasurementSlug> = {
	descriptor: SubstanceDescriptor<Slug>;
	/** Converts the readable amount a person types into the canonical unit. */
	amountFromInput: (value: number) => number;
	store?: Pick<SubstanceStore<Slug>, "logCatalogue" | "logFree">;
	now?: () => Date;
};

/**
 * Picking what to log. Servings come first because a repeat is the common
 * case; "something else" writes a complete entry so no library is needed.
 */
export function SubstanceLogScreen<
	Slug extends ConsumptionDerivedMeasurementSlug,
>({
	descriptor,
	amountFromInput,
	store,
	now = () => new Date(),
}: SubstanceLogScreenProps<Slug>) {
	const { t } = useTranslation("nicotine");
	const substance = useMemo(
		() => store ?? createSubstanceStore(descriptor),
		[store, descriptor],
	);
	const catalogue = useMemo(() => descriptor.catalogue(), [descriptor]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const at = now();
	const [localDay, setLocalDay] = useState(localDayOf(at));
	const [time, setTime] = useState(localTimeOf(at.getTime()));
	const [freeOpen, setFreeOpen] = useState(false);
	const [freeLabel, setFreeLabel] = useState("");
	const [freeServing, setFreeServing] = useState("");
	const [freeAmount, setFreeAmount] = useState("");

	async function submit(work: () => Promise<unknown>) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await work();
			router.back();
		} catch (caught) {
			setError(toMessage(caught));
			setBusy(false);
		}
	}

	function logServing(entry: SubstanceCatalogueEntry, servingId: string) {
		void submit(() =>
			substance.logCatalogue(entry.id, servingId, 1, { localDay, time }),
		);
	}

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			<Card style={styles.section}>
				<View style={styles.row}>
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
			</Card>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<Card style={styles.section}>
				<SectionHeader title={descriptor.copy.browseTitle()} />
				{catalogue.map((entry) => (
					<View key={entry.id} style={styles.section}>
						<AppText variant="label">{entry.label}</AppText>
						{entry.servings.map((serving) => (
							<ListRow
								key={`${entry.id}:${serving.id}`}
								title={serving.label}
								disabled={busy}
								onPress={() => logServing(entry, serving.id)}
							/>
						))}
					</View>
				))}
			</Card>

			<Card style={styles.section}>
				<SectionHeader title={descriptor.copy.freeTitle()} />
				{freeOpen ? (
					<>
						<FormField
							label={t("free.label")}
							placeholder={t("free.labelPlaceholder")}
							value={freeLabel}
							onChangeText={setFreeLabel}
						/>
						<FormField
							label={t("free.servingLabel")}
							value={freeServing}
							onChangeText={setFreeServing}
						/>
						<FormField
							label={t("free.amount")}
							value={freeAmount}
							onChangeText={setFreeAmount}
							keyboardType="decimal-pad"
						/>
						<AppText variant="caption" color="muted">
							{t("free.amountHint")}
						</AppText>
						<Button
							label={t("free.save")}
							disabled={busy}
							onPress={() =>
								void submit(() =>
									substance.logFree({
										label: freeLabel,
										servingLabel: freeServing.trim() || null,
										quantity: 1,
										amount: amountFromInput(Number(freeAmount)),
										localDay,
										time,
									}),
								)
							}
						/>
					</>
				) : (
					<ListRow
						title={descriptor.copy.freeTitle()}
						detail={descriptor.copy.freeDetail()}
						onPress={() => setFreeOpen(true)}
					/>
				)}
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: { flexDirection: "row", gap: theme.spacing.md },
	grow: { flex: 1 },
}));
