import type { HabitAdherenceState } from "@bro/logic";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText } from "../../components/app-text";
import { EmptyState } from "../../components/empty-state";
import { Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createHabitsStore,
	type HabitDetail,
	type HabitsStore,
} from "../../habits/habits-store";
import { StyleSheet } from "../../theme/unistyles";

export type HabitDetailScreenProps = {
	id: string;
	store?: Pick<HabitsStore, "loadHabitDetail">;
};

const STATE_LABELS: Record<HabitAdherenceState, string> = {
	done: "Done",
	missed: "Missed",
	unscheduled: "Unscheduled",
	"no-data": "No data",
};

export function HabitDetailScreen({ id, store }: HabitDetailScreenProps) {
	const habits = useMemo(() => store ?? createHabitsStore(), [store]);
	const [detail, setDetail] = useState<HabitDetail | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setDetail(await habits.loadHabitDetail(id));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setLoaded(true);
		}
	}, [habits, id]);

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
	if (error || !detail) {
		return (
			<Screen centered padded>
				<EmptyState
					title={error ? "Habit record could not be loaded" : "Habit not found"}
					body={error ?? "This habit is no longer available."}
					actionLabel={error ? "Try again" : undefined}
					onAction={error ? () => void load() : undefined}
					tone={error ? "danger" : "default"}
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			<SectionHeader title={detail.label} eyebrow="LAST 8 WEEKS" />
			<AppText color="muted">
				A descriptive record of scheduled days. Missing metric data is kept
				separate from a missed habit.
			</AppText>
			<View style={styles.grid}>
				{detail.days.map((day) => (
					<View
						key={day.localDay}
						accessible
						accessibilityLabel={`${day.localDay}: ${STATE_LABELS[day.state]}`}
						style={[styles.day, styles[day.state]]}
					/>
				))}
			</View>
			<View style={styles.legend}>
				{(Object.keys(STATE_LABELS) as HabitAdherenceState[]).map((state) => (
					<View key={state} style={styles.legendItem}>
						<View style={[styles.legendDay, styles[state]]} />
						<AppText variant="caption" color="muted">
							{STATE_LABELS[state]}
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
		backgroundColor: theme.colors.brand,
		borderColor: theme.colors.brand,
	},
	missed: {
		backgroundColor: theme.colors.onDanger,
		borderColor: theme.colors.danger,
	},
	unscheduled: {
		backgroundColor: theme.colors.selected,
		borderColor: theme.colors.border,
	},
	"no-data": {
		backgroundColor: theme.colors.surface,
		borderColor: theme.colors.textSubtle,
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
