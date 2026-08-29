import type { ShownInsight } from "@bro/logic";
import { formatInsightValue, renderInsightSummary } from "@bro/logic";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LoadingIndicator } from "../../components/loading-indicator";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createInsightStore,
	type InsightStore,
} from "../../insight/insight-store";
import { StyleSheet } from "../../theme/unistyles";

type InsightDetailScreenProps = {
	id: string;
	store?: Pick<InsightStore, "loadDetail">;
};

export function InsightDetailScreen({ id, store }: InsightDetailScreenProps) {
	const { t } = useTranslation(["insights", "common"]);
	const insights = useMemo(() => store ?? createInsightStore(), [store]);
	const [insight, setInsight] = useState<ShownInsight | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setInsight(await insights.loadDetail(id));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setLoaded(true);
		}
	}, [id, insights]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	if (!loaded) {
		return (
			<Screen centered>
				<LoadingIndicator size="large" />
			</Screen>
		);
	}
	if (error || !insight) {
		return (
			<Screen centered padded>
				<EmptyState
					title={error ? t("detail.loadFailed") : t("detail.goneTitle")}
					body={error ?? t("detail.goneBody")}
					actionLabel={error ? t("common:actions.tryAgain") : undefined}
					onAction={error ? () => void load() : undefined}
					tone={error ? "danger" : "default"}
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			<SectionHeader
				title={t("detail.title")}
				eyebrow={t("patterns.eyebrow")}
			/>
			<AppText variant="score">{renderInsightSummary(insight)}</AppText>

			<View style={styles.arms}>
				<Card style={styles.arm}>
					<AppText variant="caption" color="muted">
						{insight.pair.copy.trueArmLabel}
					</AppText>
					<AppText variant="score">
						{formatInsightValue(insight.pair, insight.trueArm.mean)}
					</AppText>
					<AppText variant="caption" color="subtle">
						{t("detail.days", { count: insight.trueArm.count })}
					</AppText>
				</Card>
				<Card style={styles.arm}>
					<AppText variant="caption" color="muted">
						{insight.pair.copy.falseArmLabel}
					</AppText>
					<AppText variant="score">
						{formatInsightValue(insight.pair, insight.falseArm.mean)}
					</AppText>
					<AppText variant="caption" color="subtle">
						{t("detail.days", { count: insight.falseArm.count })}
					</AppText>
				</Card>
			</View>

			<Card style={styles.note}>
				<SectionHeader title={t("detail.noteTitle")} />
				<AppText color="muted">{t("detail.noteBody")}</AppText>
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	arms: { flexDirection: "row", gap: theme.spacing.md },
	arm: { flex: 1, gap: theme.spacing.sm },
	note: { gap: theme.spacing.md },
}));
