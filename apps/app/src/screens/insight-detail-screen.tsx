import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText } from "../components/app-text";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import type { ShownInsight } from "../insight/engine";
import {
	createInsightStore,
	type InsightStore,
} from "../insight/insight-store";
import {
	formatInsightValue,
	renderInsightSummary,
} from "../insight/presentation";
import { StyleSheet } from "../theme/unistyles";

type InsightDetailScreenProps = {
	id: string;
	store?: Pick<InsightStore, "loadDetail">;
};

export function InsightDetailScreen({ id, store }: InsightDetailScreenProps) {
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
				<ActivityIndicator size="large" />
			</Screen>
		);
	}
	if (error || !insight) {
		return (
			<Screen centered padded>
				<EmptyState
					title={
						error
							? "Insight could not be loaded"
							: "This pattern is no longer showing"
					}
					body={
						error ??
						"Insights change with your record and disappear when the evidence no longer supports them."
					}
					actionLabel={error ? "Try again" : undefined}
					onAction={error ? () => void load() : undefined}
					tone={error ? "danger" : "default"}
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			<SectionHeader title="What your record shows" eyebrow="LAST 90 DAYS" />
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
						{insight.trueArm.count} days
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
						{insight.falseArm.count} days
					</AppText>
				</Card>
			</View>

			<Card style={styles.note}>
				<SectionHeader title="A note on this pattern" />
				<AppText color="muted">
					This is an association in your own record. It does not show that one
					thing caused the other, and it is not advice.
				</AppText>
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	arms: { flexDirection: "row", gap: theme.spacing.md },
	arm: { flex: 1, gap: theme.spacing.sm },
	note: { gap: theme.spacing.md },
}));
