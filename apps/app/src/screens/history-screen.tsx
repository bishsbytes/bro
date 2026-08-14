import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
	createHistoryStore,
	type HistoryDaySummary,
	type HistoryStore,
} from "../history/history-store";

type HistoryScreenProps = {
	store?: Pick<HistoryStore, "loadHistory">;
};

export function HistoryScreen({ store }: HistoryScreenProps) {
	const history = useMemo(() => store ?? createHistoryStore(), [store]);
	const [days, setDays] = useState<HistoryDaySummary[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setDays(await history.loadHistory());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [history]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	if (!days && !error) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()}>
					<Text style={styles.back}>Back</Text>
				</TouchableOpacity>
				<Text style={styles.title}>History</Text>
			</View>

			{error ? (
				<View style={styles.emptyCard}>
					<Text style={styles.error}>History could not be loaded: {error}</Text>
					<TouchableOpacity onPress={load}>
						<Text style={styles.link}>Try again</Text>
					</TouchableOpacity>
				</View>
			) : null}

			{days?.length === 0 ? (
				<View style={styles.emptyCard}>
					<Text style={styles.sectionTitle}>Nothing logged yet</Text>
					<Text style={styles.body}>Your check-ins will appear here.</Text>
				</View>
			) : null}

			{days?.map((day) => (
				<TouchableOpacity
					key={day.localDay}
					accessibilityRole="button"
					accessibilityLabel={`Open ${day.localDay}`}
					style={styles.dayCard}
					onPress={() =>
						router.push({
							pathname: "/history/[localDay]",
							params: { localDay: day.localDay },
						})
					}
				>
					<Text style={styles.day}>{day.localDay}</Text>
					{day.moodValues.length > 0 || day.energyValues.length > 0 ? (
						<Text style={styles.summary}>
							Mood {day.moodValues.join(", ")} · Energy{" "}
							{day.energyValues.join(", ")}
						</Text>
					) : null}
					{day.factorLabels.length > 0 ? (
						<Text style={styles.body}>
							Factors: {day.factorLabels.join(", ")}
						</Text>
					) : null}
					{day.noteBodies.map((body, index) => (
						<Text key={`${day.localDay}-note-${index}`} style={styles.note}>
							{body}
						</Text>
					))}
				</TouchableOpacity>
			))}
		</ScrollView>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: { flex: 1, backgroundColor: theme.colors.background },
	content: { padding: theme.spacing.xl, gap: theme.spacing.lg },
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: theme.colors.background,
	},
	header: { gap: theme.spacing.sm },
	back: { ...theme.typography.label, color: theme.colors.brand },
	title: { ...theme.typography.title, color: theme.colors.text },
	dayCard: {
		padding: theme.spacing.lg,
		gap: theme.spacing.xs,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	emptyCard: {
		padding: theme.spacing.xl,
		gap: theme.spacing.sm,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	day: { ...theme.typography.section, color: theme.colors.text },
	sectionTitle: { ...theme.typography.section, color: theme.colors.text },
	summary: { ...theme.typography.score, color: theme.colors.text },
	body: { ...theme.typography.body, color: theme.colors.textMuted },
	note: { ...theme.typography.body, color: theme.colors.text },
	error: { ...theme.typography.body, color: theme.colors.danger },
	link: { ...theme.typography.label, color: theme.colors.brand },
}));
