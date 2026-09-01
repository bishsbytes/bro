import type { ConsumptionDerivedMeasurementSlug } from "@bro/domain/metric-registry";
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
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	createSubstanceStore,
	type SubstanceDescriptor,
	type SubstanceStore,
} from "../../substances/substance-store";
import { StyleSheet } from "../../theme/unistyles";

type SubstanceGoalsScreenProps<Slug extends ConsumptionDerivedMeasurementSlug> =
	{
		descriptor: SubstanceDescriptor<Slug>;
		store?: Pick<
			SubstanceStore<Slug>,
			"loadToday" | "createGoal" | "achieveGoal" | "abandonGoal"
		>;
	};

/**
 * A daily ceiling on the stream's metric. Walking the target down week by week
 * is how someone tapers; the catalogue's at-most-zero habit covers quitting.
 */
export function SubstanceGoalsScreen<
	Slug extends ConsumptionDerivedMeasurementSlug,
>({ descriptor, store }: SubstanceGoalsScreenProps<Slug>) {
	const { t } = useTranslation("common");
	const substance = useMemo(
		() => store ?? createSubstanceStore(descriptor),
		[store, descriptor],
	);
	const [busy, setBusy] = useState(false);
	const [editingSlug, setEditingSlug] = useState<string | null>(null);
	const [target, setTarget] = useState("");
	const [targetDate, setTargetDate] = useState("");
	const {
		data: snapshot,
		error,
		loading,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(useCallback(() => substance.loadToday(), [substance]));

	async function mutate(work: () => Promise<unknown>) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await substance.loadToday());
			setEditingSlug(null);
			setTarget("");
			setTargetDate("");
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
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			{error ? <AppText color="danger">{error}</AppText> : null}
			{snapshot.metrics.map((metric) => {
				const active = metric.goals.find((goal) => goal.status === "active");
				return (
					<Card key={metric.metric.slug} style={styles.section}>
						<SectionHeader
							title={metric.metric.label}
							eyebrow={descriptor.copy.goals()}
						/>
						{active ? (
							<>
								<AppText>
									{descriptor.copy.goalSummary(
										active.targetFormatted,
										active.currentFormatted ?? t("emDash"),
									)}
								</AppText>
								{active.targetReached ? (
									<AppText variant="caption" color="brand">
										{descriptor.copy.goalTargetReached()}
									</AppText>
								) : active.progressPercent !== null ? (
									<AppText variant="caption" color="brand">
										{descriptor.copy.goalPercent(active.progressPercent)}
									</AppText>
								) : null}
								<View style={styles.row}>
									<Button
										label={descriptor.copy.goalAchieve()}
										variant="secondary"
										disabled={busy}
										style={styles.grow}
										onPress={() =>
											void mutate(() => substance.achieveGoal(active.goal.id))
										}
									/>
									<Button
										label={descriptor.copy.goalAbandon()}
										variant="text"
										disabled={busy}
										style={styles.grow}
										onPress={() =>
											void mutate(() => substance.abandonGoal(active.goal.id))
										}
									/>
								</View>
							</>
						) : editingSlug === metric.metric.slug ? (
							<>
								<FormField
									label={descriptor.copy.goalTargetField(metric.displayUnit)}
									value={target}
									onChangeText={setTarget}
									keyboardType="decimal-pad"
								/>
								<DateField
									label={descriptor.copy.goalTargetDateField()}
									value={targetDate}
									onChangeDate={setTargetDate}
									allowClear
								/>
								<Button
									label={descriptor.copy.goalSave()}
									loading={busy}
									onPress={() =>
										void mutate(() =>
											substance.createGoal(
												metric.metric.slug,
												target,
												targetDate.trim() || null,
											),
										)
									}
								/>
							</>
						) : metric.dayValue !== null ? (
							<Button
								label={descriptor.copy.goalSetFor(metric.metric.label)}
								variant="secondary"
								onPress={() => setEditingSlug(metric.metric.slug)}
							/>
						) : (
							// A goal needs a series to start from; logging comes first.
							<AppText variant="caption" color="muted">
								{descriptor.copy.goalNeedsLog()}
							</AppText>
						)}
					</Card>
				);
			})}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: { flexDirection: "row", gap: theme.spacing.md },
	grow: { flex: 1 },
}));
