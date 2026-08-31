import type { HabitAdherenceState } from "@bro/logic";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { EmptyState } from "../../components/empty-state";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { createHabitsStore, type HabitsStore } from "../../habits/habits-store";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

export type HabitDetailScreenProps = {
	id: string;
	store?: Pick<HabitsStore, "loadHabitDetail">;
};

/** Ordered as the legend renders them. */
const ADHERENCE_STATES: readonly HabitAdherenceState[] = [
	"done",
	"missed",
	"unscheduled",
	"no-data",
];

const STATE_KEYS = {
	done: "detail.stateDone",
	missed: "detail.stateMissed",
	unscheduled: "detail.stateUnscheduled",
	"no-data": "detail.stateNoData",
} as const;

export function HabitDetailScreen({ id, store }: HabitDetailScreenProps) {
	const { t } = useTranslation(["habits", "common"]);
	const habits = useMemo(() => store ?? createHabitsStore(), [store]);
	const {
		data: detail,
		error,
		loading,
		reload,
	} = useFocusStoreLoad(
		useCallback(() => habits.loadHabitDetail(id), [habits, id]),
	);

	if (loading) {
		return <LoadingScreen />;
	}
	if (error || !detail) {
		return (
			<Screen centered padded>
				<EmptyState
					title={error ? t("detail.loadFailed") : t("detail.notFound")}
					body={error ?? t("detail.notFoundBody")}
					actionLabel={error ? t("common:actions.tryAgain") : undefined}
					onAction={error ? () => void reload() : undefined}
					tone={error ? "danger" : "default"}
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			<SectionHeader title={detail.label} eyebrow={t("detail.eyebrow")} />
			<AppText color="muted">{t("detail.intro")}</AppText>
			<View style={styles.grid}>
				{detail.days.map((day) => (
					<View
						key={day.localDay}
						accessible
						accessibilityLabel={t("detail.daySummary", {
							day: day.localDay,
							state: t(STATE_KEYS[day.state]),
						})}
						style={[styles.day, styles[day.state]]}
					/>
				))}
			</View>
			<View style={styles.legend}>
				{ADHERENCE_STATES.map((state) => (
					<View key={state} style={styles.legendItem}>
						<View style={[styles.legendDay, styles[state]]} />
						<AppText variant="caption" color="muted">
							{t(STATE_KEYS[state])}
						</AppText>
					</View>
				))}
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	day: {
		width: "11%",
		aspectRatio: 1,
		borderRadius: theme.radius.xs,
		borderWidth: 1,
	},
	done: {
		backgroundColor: theme.colors.body,
		borderColor: theme.colors.body,
	},
	missed: {
		borderColor: theme.colors.lineStrong,
		borderStyle: "dashed",
	},
	unscheduled: {
		backgroundColor: theme.colors.surfaceSunk,
		borderColor: theme.colors.line,
	},
	"no-data": {
		backgroundColor: theme.colors.surface,
		borderColor: theme.colors.lineStrong,
		borderStyle: "dashed",
	},
	legend: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.lg },
	legendItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
	},
	legendDay: {
		width: 16,
		height: 16,
		borderRadius: theme.radius.xs,
		borderWidth: 1,
	},
}));
