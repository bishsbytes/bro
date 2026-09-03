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
import { createIntakeStore, type IntakeStore } from "../../intake/intake-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type IntakeGoalsScreenProps = {
	store?: Pick<
		IntakeStore,
		"loadToday" | "createGoal" | "achieveGoal" | "abandonGoal"
	>;
};

/**
 * A target on a tracked total, stated against its seven-day average and never
 * graded: no percentage of the way, no reached or missed, no colour. Walking a
 * ceiling down week by week is how someone tapers; the catalogue's at-most
 * habits cover the days that should be zero.
 */
export function IntakeGoalsScreen({ store }: IntakeGoalsScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const intake = useMemo(() => store ?? createIntakeStore(), [store]);
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
	} = useFocusStoreLoad(useCallback(() => intake.loadToday(), [intake]));

	async function mutate(work: () => Promise<unknown>) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await intake.loadToday());
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
					title={t("intake:loadFailed")}
					body={error ?? t("intake:loadFailedBody")}
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			{error ? <AppText color="danger">{error}</AppText> : null}
			{snapshot.totals.length === 0 ? (
				<AppText color="muted">{t("intake:goals.needMetrics")}</AppText>
			) : null}
			{snapshot.totals.map((summary) => {
				const active = summary.goals.find((goal) => goal.status === "active");
				return (
					<Card key={summary.metric.slug} style={styles.section}>
						<SectionHeader
							title={summary.metric.label}
							eyebrow={t("intake:goals.title")}
						/>
						{active ? (
							<>
								<AppText>
									{t("intake:goals.summary", {
										target: active.targetFormatted,
										current: active.currentFormatted ?? t("common:emDash"),
									})}
								</AppText>
								<View style={styles.row}>
									<Button
										label={t("intake:goals.achieve")}
										variant="secondary"
										disabled={busy}
										style={styles.grow}
										onPress={() =>
											void mutate(() => intake.achieveGoal(active.goal.id))
										}
									/>
									<Button
										label={t("intake:goals.abandon")}
										variant="text"
										disabled={busy}
										style={styles.grow}
										onPress={() =>
											void mutate(() => intake.abandonGoal(active.goal.id))
										}
									/>
								</View>
							</>
						) : editingSlug === summary.metric.slug ? (
							<>
								<FormField
									label={t("intake:goals.targetField", {
										unit: summary.displayUnit,
									})}
									value={target}
									onChangeText={setTarget}
									keyboardType="decimal-pad"
								/>
								<DateField
									label={t("intake:goals.targetDateField")}
									value={targetDate}
									onChangeDate={setTargetDate}
									allowClear
								/>
								<Button
									label={t("intake:goals.save")}
									loading={busy}
									onPress={() =>
										void mutate(() =>
											intake.createGoal(
												summary.metric.slug,
												target,
												targetDate.trim() || null,
											),
										)
									}
								/>
							</>
						) : summary.dayValue !== null || summary.weekValue !== null ? (
							<Button
								label={t("intake:goals.setFor", { name: summary.metric.label })}
								variant="secondary"
								onPress={() => setEditingSlug(summary.metric.slug)}
							/>
						) : (
							<AppText variant="caption" color="muted">
								{t("intake:goals.needValue")}
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
