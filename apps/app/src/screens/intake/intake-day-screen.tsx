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
import { TimeField } from "../../components/time-field";
import { upperCaseForLanguage } from "../../i18n";
import {
	createIntakeStore,
	type IntakeEventEdit,
	type IntakeStore,
	type PresentedIntakeEvent,
} from "../../intake/intake-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type IntakeDayScreenProps = {
	localDay: string | null;
	store?: Pick<IntakeStore, "loadDay" | "updateEvent" | "deleteEvent">;
};

function EventEditor({
	presented,
	busy,
	onSave,
	onDelete,
}: {
	presented: PresentedIntakeEvent;
	busy: boolean;
	onSave: (edit: IntakeEventEdit) => void;
	onDelete: () => void;
}) {
	const { t } = useTranslation("intake");
	const { event } = presented;
	const [name, setName] = useState(event.name);
	const [portionLabel, setPortionLabel] = useState(event.portionLabel ?? "");
	const [quantity, setQuantity] = useState(String(event.quantity));
	const [localDay, setLocalDay] = useState(event.localDay);
	const [time, setTime] = useState(localTimeOf(event.occurredAt));

	return (
		<Card style={styles.section}>
			<SectionHeader
				title={event.name}
				eyebrow={upperCaseForLanguage(t(`kinds.${event.kind}`))}
			/>
			{presented.contributions ? (
				<AppText variant="caption" color="muted">
					{t("event.storedSnapshot", { value: presented.contributions })}
				</AppText>
			) : null}
			<FormField label={t("event.name")} value={name} onChangeText={setName} />
			<FormField
				label={t("event.portion")}
				value={portionLabel}
				onChangeText={setPortionLabel}
			/>
			<View style={styles.row}>
				<FormField
					label={t("event.quantity")}
					value={quantity}
					onChangeText={setQuantity}
					keyboardType="decimal-pad"
					containerStyle={styles.grow}
				/>
				<DateField
					label={t("event.date")}
					value={localDay}
					onChangeDate={setLocalDay}
					containerStyle={styles.grow}
				/>
				<TimeField
					label={t("event.time")}
					value={time}
					onChangeTime={setTime}
					containerStyle={styles.grow}
				/>
			</View>
			<View style={styles.row}>
				<Button
					label={t("event.save")}
					variant="secondary"
					disabled={busy}
					style={styles.grow}
					onPress={() =>
						onSave({
							name,
							portionLabel: portionLabel.trim() || null,
							quantity: Number(quantity),
							localDay,
							time,
						})
					}
				/>
				<Button
					label={t("event.delete")}
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

/**
 * A day's events, editable and deletable; every total re-derives on save.
 * Quantity is the only lever on the snapshotted amounts.
 */
export function IntakeDayScreen({ localDay, store }: IntakeDayScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const intake = useMemo(() => store ?? createIntakeStore(), [store]);
	const [busy, setBusy] = useState(false);
	const {
		data: snapshot,
		error,
		loading,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(
		useCallback(
			() =>
				localDay === null ? Promise.resolve(null) : intake.loadDay(localDay),
			[intake, localDay],
		),
	);

	async function mutate(work: () => Promise<unknown>) {
		if (busy || localDay === null) return;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await intake.loadDay(localDay));
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
					title={t("intake:day.notFound")}
					body={error ?? t("intake:day.notFoundBody")}
					actionLabel={t("intake:day.back")}
					onAction={() => router.replace("/intake" as Href)}
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			<Card style={styles.section}>
				<SectionHeader
					title={snapshot.localDay}
					eyebrow={t("intake:day.eyebrow")}
				/>
				{snapshot.totals.length === 0 ? (
					<AppText variant="caption" color="muted">
						{t("intake:tab.totalsEmpty")}
					</AppText>
				) : (
					<View style={styles.totals}>
						{snapshot.totals.map((total) => (
							<View key={total.metric.slug} style={styles.total}>
								<AppText variant="micro" color="subtle">
									{upperCaseForLanguage(total.metric.label)}
								</AppText>
								<AppText variant="label">
									{total.dayFormatted ?? t("common:emDash")}
								</AppText>
							</View>
						))}
					</View>
				)}
			</Card>

			{error ? <AppText color="danger">{error}</AppText> : null}

			{snapshot.events.length === 0 ? (
				<EmptyState
					title={t("intake:day.emptyTitle")}
					body={t("intake:day.emptyBody")}
				/>
			) : (
				snapshot.events.map((presented) => (
					<EventEditor
						key={`${presented.event.id}:${presented.event.updatedAt}`}
						presented={presented}
						busy={busy}
						onSave={(edit) =>
							void mutate(() => intake.updateEvent(presented.event.id, edit))
						}
						onDelete={() =>
							void mutate(() => intake.deleteEvent(presented.event.id))
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
	total: { minWidth: "28%", flexGrow: 1, gap: theme.spacing.xs },
}));
