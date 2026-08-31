import type { CheckInSlotAssignment } from "@bro/domain/metric-registry";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	type CheckInSettingsStore,
	createCheckInSettingsStore,
} from "../../check-in/check-in-settings-store";
import { TAG_CATEGORY_KEYS } from "../../check-in/tag-categories";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { ThemedSwitch } from "../../components/themed-switch";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type CheckInSettingsScreenProps = {
	store?: Pick<CheckInSettingsStore, "load" | "setEnabled" | "setCheckInSlots">;
};

/** Offered in the order a day runs, with both last. */
const SLOT_CHOICES = [
	"morning",
	"evening",
	"both",
] as const satisfies readonly CheckInSlotAssignment[];

export function CheckInSettingsScreen({ store }: CheckInSettingsScreenProps) {
	const { t } = useTranslation(["settings", "checkIn", "common"]);
	const checkIns = useMemo(
		() => store ?? createCheckInSettingsStore(),
		[store],
	);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(useCallback(() => checkIns.load(), [checkIns]));

	async function setEnabled(metricSlug: string, enabled: boolean) {
		await mutate(metricSlug, () => checkIns.setEnabled(metricSlug, enabled));
	}

	async function setCheckInSlots(
		metricSlug: string,
		checkInSlots: CheckInSlotAssignment,
	) {
		await mutate(metricSlug, () =>
			checkIns.setCheckInSlots(metricSlug, checkInSlots),
		);
	}

	async function mutate(
		metricSlug: string,
		work: () => Promise<Awaited<ReturnType<CheckInSettingsStore["load"]>>>,
	) {
		setBusyKey(metricSlug);
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
					title={t("checkIns.loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const groupedTags = Object.entries(TAG_CATEGORY_KEYS).flatMap(
		([category, key]) => {
			const tags = snapshot.tags.filter((tag) => tag.category === category);
			return tags.length > 0
				? [{ category, label: t(`checkIn:${key}` as const), tags }]
				: [];
		},
	);

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("checkIns.intro")}</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}
			<View style={styles.section}>
				{snapshot.metrics.map((metric) => (
					<Card key={metric.metricSlug} style={styles.metricCard}>
						<View style={styles.row}>
							<View style={styles.grow}>
								<AppText variant="label">{metric.label}</AppText>
								<AppText variant="caption" color="muted">
									{metric.sensitive
										? t("checkIns.scoredSensitive")
										: t("checkIns.scored")}
								</AppText>
							</View>
							<ThemedSwitch
								accessibilityLabel={
									metric.enabled
										? t("checkIns.removeScore", { name: metric.label })
										: t("checkIns.addScore", { name: metric.label })
								}
								value={metric.enabled}
								disabled={busyKey !== null}
								onValueChange={(enabled) =>
									void setEnabled(metric.metricSlug, enabled)
								}
							/>
						</View>
						{/* Which sittings ask it only means anything while it is on. */}
						{metric.enabled ? (
							<View style={styles.slots}>
								{SLOT_CHOICES.map((choice) => {
									const selected = metric.checkInSlots === choice;
									return (
										<Button
											key={choice}
											label={t(`checkIns.slotChoice.${choice}`)}
											accessibilityLabel={t("checkIns.askIn", {
												name: metric.label,
												when: t(`checkIns.slotChoice.${choice}`),
											})}
											accessibilityState={{ selected }}
											variant={selected ? "primary" : "secondary"}
											disabled={busyKey !== null}
											style={styles.slotButton}
											onPress={() =>
												void setCheckInSlots(metric.metricSlug, choice)
											}
										/>
									);
								})}
							</View>
						) : null}
					</Card>
				))}
			</View>
			<AppText variant="caption" color="subtle">
				{t("checkIns.scoresNote")}
			</AppText>
			<SectionHeader title={t("checkIns.tagsTitle")} />
			<AppText color="muted">{t("checkIns.tagsIntro")}</AppText>
			{groupedTags.map(({ category, label, tags }) => (
				<View key={category} style={styles.section}>
					<AppText variant="caption" color="subtle">
						{label}
					</AppText>
					{tags.map((tag) => (
						<Card key={tag.metricSlug} style={styles.row}>
							<View style={styles.grow}>
								<AppText variant="label">{tag.label}</AppText>
								{tag.sensitive ? (
									<AppText variant="caption" color="muted">
										{t("checkIns.sensitive")}
									</AppText>
								) : null}
							</View>
							<ThemedSwitch
								accessibilityLabel={
									tag.enabled
										? t("checkIns.removeTag", { name: tag.label })
										: t("checkIns.addTag", { name: tag.label })
								}
								value={tag.enabled}
								disabled={busyKey !== null}
								onValueChange={(enabled) =>
									void setEnabled(tag.metricSlug, enabled)
								}
							/>
						</Card>
					))}
				</View>
			))}
			<AppText variant="caption" color="subtle">
				{t("checkIns.tagsNote")}
			</AppText>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
	grow: { flex: 1, gap: theme.spacing.xs },
	metricCard: { gap: theme.spacing.md },
	slots: { flexDirection: "row", gap: theme.spacing.sm },
	slotButton: { flex: 1 },
}));
