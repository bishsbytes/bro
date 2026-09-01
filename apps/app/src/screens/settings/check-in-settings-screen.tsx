import type {
	CheckInSlotAssignment,
	TagCategory,
} from "@bro/domain/metric-registry";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	type CheckInScoreSetting,
	type CheckInSettingsSnapshot,
	type CheckInSettingsStore,
	createCheckInSettingsStore,
} from "../../check-in/check-in-settings-store";
import { TAG_CATEGORY_KEYS } from "../../check-in/tag-categories";
import { AppText } from "../../components/app-text";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { OptionSheet, type SheetOption } from "../../components/option-sheet";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type CheckInSettingsScreenProps = {
	store?: Pick<CheckInSettingsStore, "load" | "setEnabled" | "setCheckInSlots">;
};

/**
 * A score is off, or asked in one sitting or both. Holding "off" alongside the
 * sittings makes it one decision rather than a switch plus a follow-up.
 */
type ScoreChoice = "off" | CheckInSlotAssignment;

const SCORE_CHOICES = [
	"off",
	"morning",
	"evening",
	"both",
] as const satisfies readonly ScoreChoice[];

function scoreChoiceOf(metric: CheckInScoreSetting): ScoreChoice {
	return metric.enabled ? metric.checkInSlots : "off";
}

export function CheckInSettingsScreen({ store }: CheckInSettingsScreenProps) {
	const { t } = useTranslation(["settings", "checkIn", "common"]);
	const checkIns = useMemo(
		() => store ?? createCheckInSettingsStore(),
		[store],
	);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [editingScore, setEditingScore] = useState<string | null>(null);
	const [editingTags, setEditingTags] = useState<TagCategory | null>(null);
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(useCallback(() => checkIns.load(), [checkIns]));

	async function mutate(
		metricSlug: string,
		work: () => Promise<CheckInSettingsSnapshot>,
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

	async function chooseScore(metric: CheckInScoreSetting, choice: ScoreChoice) {
		setEditingScore(null);
		if (choice === scoreChoiceOf(metric)) return;
		await mutate(metric.metricSlug, async () => {
			if (choice === "off") {
				return await checkIns.setEnabled(metric.metricSlug, false);
			}
			// A score turned back on keeps the sitting it already had, so only a
			// genuinely new sitting costs a second write.
			const enabled = metric.enabled
				? null
				: await checkIns.setEnabled(metric.metricSlug, true);
			if (enabled && metric.checkInSlots === choice) return enabled;
			return await checkIns.setCheckInSlots(metric.metricSlug, choice);
		});
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
				? [
						{
							category: category as TagCategory,
							label: t(`checkIn:${key}` as const),
							tags,
						},
					]
				: [];
		},
	);
	const editingMetric =
		snapshot.metrics.find((metric) => metric.metricSlug === editingScore) ??
		null;
	const editingGroup =
		groupedTags.find((group) => group.category === editingTags) ?? null;

	const scoreOptions: SheetOption<ScoreChoice>[] = editingMetric
		? SCORE_CHOICES.map((choice) => ({
				value: choice,
				label: t(`checkIns.slotChoice.${choice}`),
				detail: t(`checkIns.slotDetail.${choice}`),
				accessibilityLabel:
					choice === "off"
						? t("checkIns.dontAsk", { name: editingMetric.label })
						: t("checkIns.askIn", {
								name: editingMetric.label,
								when: t(`checkIns.slotChoice.${choice}`),
							}),
			}))
		: [];

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("checkIns.intro")}</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader title={t("checkIns.scoresTitle")} />
				{snapshot.metrics.map((metric) => (
					<ListRow
						key={metric.metricSlug}
						title={metric.label}
						detail={
							metric.sensitive
								? t("checkIns.scoredSensitive")
								: t("checkIns.scored")
						}
						value={t(`checkIns.slotChoice.${scoreChoiceOf(metric)}`)}
						accessibilityLabel={t("checkIns.scoreA11y", { name: metric.label })}
						disabled={busyKey !== null}
						onPress={() => setEditingScore(metric.metricSlug)}
					/>
				))}
			</View>
			<AppText variant="caption" color="subtle">
				{t("checkIns.scoresNote")}
			</AppText>

			<View style={styles.section}>
				<SectionHeader title={t("checkIns.tagsTitle")} />
				<AppText color="muted">{t("checkIns.tagsIntro")}</AppText>
				{groupedTags.map(({ category, label, tags }) => (
					<ListRow
						key={category}
						title={label}
						value={t("checkIns.tagsOn", {
							enabled: tags.filter((tag) => tag.enabled).length,
							total: tags.length,
						})}
						detail={
							tags.some((tag) => tag.sensitive)
								? t("checkIns.groupSensitive")
								: undefined
						}
						accessibilityLabel={t("checkIns.tagsA11y", { name: label })}
						disabled={busyKey !== null}
						onPress={() => setEditingTags(category)}
					/>
				))}
			</View>
			<AppText variant="caption" color="subtle">
				{t("checkIns.tagsNote")}
			</AppText>

			{editingMetric ? (
				<OptionSheet
					visible
					title={editingMetric.label}
					intro={t("checkIns.scoreSheetIntro", { name: editingMetric.label })}
					closeAccessibilityLabel={t("checkIns.scoreDismissA11y", {
						name: editingMetric.label,
					})}
					options={scoreOptions}
					selected={scoreChoiceOf(editingMetric)}
					disabled={busyKey !== null}
					onSelect={(choice) => void chooseScore(editingMetric, choice)}
					onClose={() => setEditingScore(null)}
				/>
			) : null}

			{editingGroup ? (
				<OptionSheet
					visible
					selection="multiple"
					title={editingGroup.label}
					intro={t("checkIns.tagsSheetIntro")}
					closeAccessibilityLabel={t("checkIns.tagsDismissA11y", {
						name: editingGroup.label,
					})}
					options={editingGroup.tags.map((tag) => ({
						value: tag.metricSlug,
						label: tag.label,
						detail: tag.sensitive ? t("checkIns.sensitive") : undefined,
						accessibilityLabel: tag.enabled
							? t("checkIns.removeTag", { name: tag.label })
							: t("checkIns.addTag", { name: tag.label }),
					}))}
					selected={editingGroup.tags
						.filter((tag) => tag.enabled)
						.map((tag) => tag.metricSlug)}
					disabled={busyKey !== null}
					onSelect={(metricSlug) => {
						const tag = editingGroup.tags.find(
							(candidate) => candidate.metricSlug === metricSlug,
						);
						if (!tag) return;
						void mutate(metricSlug, () =>
							checkIns.setEnabled(metricSlug, !tag.enabled),
						);
					}}
					onClose={() => setEditingTags(null)}
				/>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
}));
