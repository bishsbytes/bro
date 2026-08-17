import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import { TrendChart } from "../components/trend-chart";
import { StyleSheet } from "../theme/unistyles";
import {
	createTrendsStore,
	type TrendsSnapshot,
	type TrendsStore,
} from "../trends/trends-store";

type MindScreenProps = {
	store?: Pick<TrendsStore, "load">;
};

function latestScore(
	series: TrendsSnapshot["metrics"][number]["series"],
): number | null {
	return (
		[...series.points]
			.reverse()
			.find((point) => point.value !== null)?.value ?? null
	);
}

export function MindScreen({ store }: MindScreenProps) {
	const trends = useMemo(() => store ?? createTrendsStore(), [store]);
	const [snapshot, setSnapshot] = useState<TrendsSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setSnapshot(await trends.load(7));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [trends]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	const mindMetrics =
		snapshot?.metrics.filter(
			(item) => item.metric.slug === "mood" || item.metric.slug === "energy",
		) ?? [];

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">
				Notice how mood and energy move, then add context from the days that
				matter.
			</AppText>

			<Card style={styles.checkInCard}>
				<SectionHeader title="How are you today?" eyebrow="DAILY CHECK-IN" />
				<AppText color="muted">
					A quick check-in gives your patterns something honest to build from.
				</AppText>
				<Button label="Check in" onPress={() => router.push("/")} />
			</Card>

			<SectionHeader title="Mood and energy" eyebrow="LAST 7 DAYS" />
			{!snapshot && !error ? <ActivityIndicator size="large" /> : null}
			{error ? (
				<EmptyState
					title="Mind patterns could not be loaded"
					body={error}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			) : null}
			{snapshot && mindMetrics.length === 0 ? (
				<EmptyState
					title="Your mind patterns start here"
					body="Check in over a few days to see mood and energy take shape."
				/>
			) : null}
			{mindMetrics.map(({ metric, label, series }) => {
				const latest = latestScore(series);
				return (
					<Card key={metric.slug} style={styles.metricCard}>
						<SectionHeader
							title={label}
							action={
								<AppText variant="score">
									{latest === null ? "—" : latest.toFixed(1)}/5
								</AppText>
							}
						/>
						{series.observedDayCount > 0 ? (
							<TrendChart series={series} height={110} />
						) : (
							<AppText color="muted">
								Nothing logged in this period yet.
							</AppText>
						)}
					</Card>
				);
			})}

			<Button
				label="View all trends"
				variant="secondary"
				onPress={() => router.push("/trends")}
			/>
			<Button
				label="Open history"
				variant="text"
				onPress={() => router.push("/history")}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	checkInCard: { gap: theme.spacing.md },
	metricCard: { gap: theme.spacing.md },
}));

export default MindScreen;
