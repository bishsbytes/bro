import { type Href, router } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { LoadingScreen, Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createDrinksStore,
	type DrinkDaySnapshot,
	type DrinksStore,
} from "../../drinks/drinks-store";
import {
	createFoodStore,
	type FoodDaySnapshot,
	type FoodStore,
} from "../../food/food-store";
import { upperCaseForLanguage } from "../../i18n";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	createNicotineStore,
	type NicotineStore,
} from "../../substances/nicotine";
import { StyleSheet } from "../../theme/unistyles";

type NicotineDaySnapshot = Awaited<ReturnType<NicotineStore["loadToday"]>>;

type IntakeScreenProps = {
	drinksStore?: Pick<DrinksStore, "loadToday">;
	foodStore?: Pick<FoodStore, "loadToday">;
	nicotineStore?: Pick<NicotineStore, "loadToday" | "isTracked">;
};

type IntakeSnapshot = {
	drinks: DrinkDaySnapshot;
	food: FoodDaySnapshot;
	/** Null while the nicotine stream is switched off; see the load below. */
	nicotine: NicotineDaySnapshot | null;
};

type SummaryMetrics = readonly {
	metric: { slug: string; label: string };
	dayFormatted: string | null;
}[];

function DailySummary({
	title,
	entryCount,
	metrics,
	href,
}: {
	title: string;
	entryCount: number;
	metrics: SummaryMetrics;
	href: Href;
}) {
	const { t } = useTranslation(["intake", "common"]);

	return (
		<ListRow
			title={title}
			value={t("entries", { count: entryCount })}
			accessibilityLabel={t("open", { name: title })}
			style={styles.summaryRow}
			onPress={() => router.push(href)}
		>
			<View style={styles.summaryMetrics}>
				{metrics.map((metric) => (
					<View key={metric.metric.slug} style={styles.summaryMetric}>
						<AppText variant="micro" color="subtle">
							{upperCaseForLanguage(metric.metric.label)}
						</AppText>
						<AppText variant="label">
							{metric.dayFormatted ?? t("common:emDash")}
						</AppText>
					</View>
				))}
			</View>
		</ListRow>
	);
}

export function IntakeScreen({
	drinksStore,
	foodStore,
	nicotineStore,
}: IntakeScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const drinks = useMemo(
		() => drinksStore ?? createDrinksStore(),
		[drinksStore],
	);
	const food = useMemo(() => foodStore ?? createFoodStore(), [foodStore]);
	const nicotine = useMemo(
		() => nicotineStore ?? createNicotineStore(),
		[nicotineStore],
	);
	const {
		data: snapshot,
		error,
		loading,
		reload,
	} = useFocusStoreLoad(
		useCallback(async (): Promise<IntakeSnapshot> => {
			/**
			 * Eating and drinking are universal, so their rows are unconditional.
			 * Smoking is neither: the row appears once the stream is switched on,
			 * for the same reason the quick-log sheet asks before offering it.
			 */
			const [drinksToday, foodToday, nicotineTracked] = await Promise.all([
				drinks.loadToday(),
				food.loadToday(),
				nicotine.isTracked(),
			]);
			return {
				drinks: drinksToday,
				food: foodToday,
				nicotine: nicotineTracked ? await nicotine.loadToday() : null,
			};
		}, [drinks, food, nicotine]),
	);

	if (loading) {
		return <LoadingScreen variant="tab" />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	// Energy is the one total every stream contributes to, so it heads the card
	// once rather than repeating itself in each row beneath.
	const energy =
		snapshot.food.metrics.find(
			({ metric }) => metric.slug === "energy_intake",
		) ??
		snapshot.drinks.metrics.find(
			({ metric }) => metric.slug === "energy_intake",
		);
	const withoutEnergy = (metrics: SummaryMetrics) =>
		metrics.filter(({ metric }) => metric.slug !== "energy_intake");

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("intro")}</AppText>

			<View style={styles.section}>
				<SectionHeader title={t("today")} />
				<Card style={styles.summaryCard}>
					{energy ? (
						<View style={styles.sharedMetric}>
							<AppText variant="micro" color="subtle">
								{upperCaseForLanguage(energy.metric.label)}
							</AppText>
							<AppText variant="section">
								{energy.dayFormatted ?? t("common:emDash")}
							</AppText>
						</View>
					) : null}
					<View style={energy ? styles.summaryDivider : undefined}>
						<DailySummary
							title={t("food")}
							entryCount={snapshot.food.entries.length}
							metrics={withoutEnergy(snapshot.food.metrics)}
							href="/food"
						/>
					</View>
					<View style={styles.summaryDivider}>
						<DailySummary
							title={t("drinks")}
							entryCount={snapshot.drinks.entries.length}
							metrics={withoutEnergy(snapshot.drinks.metrics)}
							href="/drinks"
						/>
					</View>
					{snapshot.nicotine ? (
						<View style={styles.summaryDivider}>
							<DailySummary
								title={t("nicotine")}
								entryCount={snapshot.nicotine.entries.length}
								metrics={withoutEnergy(snapshot.nicotine.metrics)}
								href="/nicotine"
							/>
						</View>
					) : null}
				</Card>
			</View>

			{error ? <AppText color="danger">{error}</AppText> : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	summaryCard: { paddingVertical: theme.spacing.sm },
	sharedMetric: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
		paddingVertical: theme.spacing.md,
	},
	summaryDivider: {
		borderTopWidth: 1,
		borderTopColor: theme.colors.border,
	},
	summaryRow: {
		paddingHorizontal: theme.spacing.sm,
		paddingVertical: theme.spacing.md,
		borderRadius: 0,
		backgroundColor: "transparent",
	},
	summaryMetrics: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: theme.spacing.md,
		marginTop: theme.spacing.sm,
	},
	summaryMetric: { flex: 1, minWidth: "28%", gap: theme.spacing.xs },
}));

export default IntakeScreen;
