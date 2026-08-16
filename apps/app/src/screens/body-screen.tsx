import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Switch, View } from "react-native";
import {
	createBodyStore,
	type BodyOverview,
	type BodyStore,
} from "../body/body-store";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import { TrendChart } from "../components/trend-chart";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

type BodyScreenProps = {
	store?: Pick<BodyStore, "loadOverview" | "setTracked">;
};

function observedLabel(observedAt: number): string {
	return new Date(observedAt).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function sourceLabel(source: string): string {
	if (source === "healthkit") return "Apple Health";
	if (source === "health_connect") return "Health Connect";
	return "You";
}

export function BodyScreen({ store }: BodyScreenProps) {
	const body = useMemo(() => store ?? createBodyStore(), [store]);
	const { theme } = useUnistyles();
	const [overview, setOverview] = useState<BodyOverview | null>(null);
	const [busySlug, setBusySlug] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setOverview(await body.loadOverview());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [body]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	async function setTracked(metricSlug: string, enabled: boolean) {
		setBusySlug(metricSlug);
		setError(null);
		try {
			setOverview(await body.setTracked(metricSlug, enabled));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusySlug(null);
		}
	}

	if (!overview && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	if (!overview) {
		return (
			<Screen centered padded>
				<EmptyState
					title="Body metrics could not be loaded"
					body={error ?? "Try again."}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const visible = overview.metrics.filter((metric) => metric.visible);
	const untracked = overview.metrics.filter((metric) => !metric.visible);

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">
				Track the measurements that matter to you. Values and goals always
				follow your preferred units.
			</AppText>

			{error ? <AppText color="danger">{error}</AppText> : null}

			{visible.length === 0 ? (
				<EmptyState
					title="No body metrics tracked"
					body="Turn on a measurement below to add it to your daily check-in and Body view."
				/>
			) : null}

			{visible.map((metric) => (
				<Card key={metric.metricSlug} style={styles.metricCard}>
					<View style={styles.heading}>
						<View style={styles.grow}>
							<AppText variant="section">{metric.label}</AppText>
							{metric.latest ? (
								<>
									<AppText color="muted">
										Latest {metric.latestFormatted} ·{" "}
										{metric.latest.source === "user"
											? observedLabel(metric.latest.observedAt)
											: metric.latest.localDay}
									</AppText>
									{metric.hasImportedData ? (
										<AppText variant="micro" color="subtle">
											Source: {sourceLabel(metric.latest.source)}
										</AppText>
									) : null}
								</>
							) : (
								<AppText color="muted">Nothing logged yet</AppText>
							)}
						</View>
						{metric.userEnterable ? (
							<Switch
								accessibilityLabel={`${metric.tracked ? "Stop tracking" : "Track"} ${metric.label}`}
								value={metric.tracked}
								disabled={busySlug !== null}
								trackColor={{
									false: theme.colors.border,
									true: theme.colors.brand,
								}}
								onValueChange={(enabled) =>
									void setTracked(metric.metricSlug, enabled)
								}
							/>
						) : null}
					</View>

					{metric.series.observedDayCount > 0 ? (
						<TrendChart series={metric.series} height={100} />
					) : null}

					{metric.activeGoal ? (
						<AppText variant="caption" color="brand">
							Target {metric.activeGoal.targetFormatted}
							{metric.activeGoal.progressPercent === null
								? ""
								: ` · ${metric.activeGoal.progressPercent}% of the way`}
						</AppText>
					) : null}

					<Button
						label={`Open ${metric.label}`}
						variant="secondary"
						onPress={() =>
							router.push({
								pathname: "/body/[slug]",
								params: { slug: metric.metricSlug },
							})
						}
					/>
				</Card>
			))}

			{untracked.length > 0 ? (
				<View style={styles.trackingSection}>
					<SectionHeader title="Measurements" eyebrow="DAILY CHECK-IN" />
					{untracked.map((metric) => (
						<Card key={metric.metricSlug} style={styles.heading}>
							<View style={styles.grow}>
								<AppText variant="label">{metric.label}</AppText>
								<AppText variant="caption" color="muted">
									Enter in {metric.displayUnit}
								</AppText>
							</View>
							<Switch
								accessibilityLabel={`Track ${metric.label}`}
								value={false}
								disabled={busySlug !== null}
								trackColor={{
									false: theme.colors.border,
									true: theme.colors.brand,
								}}
								onValueChange={(enabled) =>
									void setTracked(metric.metricSlug, enabled)
								}
							/>
						</Card>
					))}
				</View>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	metricCard: { gap: theme.spacing.md },
	heading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	grow: { flex: 1, gap: theme.spacing.xs },
	trackingSection: { gap: theme.spacing.md },
}));
