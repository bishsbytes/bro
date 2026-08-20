import { localDayOf } from "@bro/domain";
import { formatLocalDayLabel } from "@bro/logic";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";
import { AppText } from "../../components/app-text";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { Screen } from "../../components/screen";
import {
	createHistoryStore,
	type HistoryDaySummary,
	type HistoryStore,
} from "../../history/history-store";

type HistoryScreenProps = {
	store?: Pick<HistoryStore, "loadHistory">;
};

export function HistoryScreen({ store }: HistoryScreenProps) {
	const history = useMemo(() => store ?? createHistoryStore(), [store]);
	const [days, setDays] = useState<HistoryDaySummary[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const todayLocalDay = localDayOf(new Date());

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
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			{error ? (
				<EmptyState
					title="History could not be loaded"
					body={error}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			) : null}

			{days?.length === 0 ? (
				<EmptyState
					title="Nothing logged yet"
					body="Your check-ins will appear here."
				/>
			) : null}

			{days?.map((day) => {
				const dayLabel = formatLocalDayLabel(day.localDay, todayLocalDay);
				return (
					<ListRow
						key={day.localDay}
						accessibilityLabel={`Open ${dayLabel}`}
						title={dayLabel}
						onPress={() =>
							router.push({
								pathname: "/history/[localDay]",
								params: { localDay: day.localDay },
							})
						}
					>
						{day.moodValues.length > 0 || day.energyValues.length > 0 ? (
							<AppText variant="score">
								Mood {day.moodValues.join(", ")} · Energy{" "}
								{day.energyValues.join(", ")}
							</AppText>
						) : null}
						{day.factorLabels.length > 0 ? (
							<AppText color="muted">
								Factors: {day.factorLabels.join(", ")}
							</AppText>
						) : null}
						{day.assessmentCount > 0 ? (
							<AppText color="muted">
								{day.assessmentCount === 1
									? "Wheel of life review"
									: `${day.assessmentCount} wheel of life reviews`}
							</AppText>
						) : null}
						{day.healthLabels && day.healthLabels.length > 0 ? (
							<AppText color="muted">
								Health: {day.healthLabels.join(", ")}
							</AppText>
						) : null}
						{day.habitLabels && day.habitLabels.length > 0 ? (
							<AppText color="muted">
								Habits: {day.habitLabels.join(", ")}
							</AppText>
						) : null}
						{day.challengeLabels && day.challengeLabels.length > 0 ? (
							<AppText color="muted">
								Challenges: {day.challengeLabels.join(", ")}
							</AppText>
						) : null}
						{day.noteBodies.map((body, index) => (
							<AppText key={`${day.localDay}-note-${index}`}>{body}</AppText>
						))}
					</ListRow>
				);
			})}
		</Screen>
	);
}
