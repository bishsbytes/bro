import { localDayOf } from "@bro/domain";
import { formatLocalDayLabel } from "@bro/logic";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppText } from "../../components/app-text";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { LoadingIndicator } from "../../components/loading-indicator";
import { StackScreen as Screen } from "../../components/screen";
import {
	createHistoryStore,
	type HistoryDaySummary,
	type HistoryStore,
} from "../../history/history-store";

type HistoryScreenProps = {
	store?: Pick<HistoryStore, "loadHistory">;
};

export function HistoryScreen({ store }: HistoryScreenProps) {
	const { t } = useTranslation(["history", "common"]);
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
				<LoadingIndicator size="large" />
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			{error ? (
				<EmptyState
					title={t("loadFailed")}
					body={error}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void load()}
					tone="danger"
				/>
			) : null}

			{days?.length === 0 ? (
				<EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
			) : null}

			{days?.map((day) => {
				const dayLabel = formatLocalDayLabel(day.localDay, todayLocalDay);
				return (
					<ListRow
						key={day.localDay}
						accessibilityLabel={t("openDay", { day: dayLabel })}
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
								{t("summary.scores", {
									mood: day.moodValues.join(", "),
									energy: day.energyValues.join(", "),
								})}
							</AppText>
						) : null}
						{day.tagLabels.length > 0 ? (
							<AppText color="muted">
								{t("summary.tags", { list: day.tagLabels.join(", ") })}
							</AppText>
						) : null}
						{day.assessmentCount > 0 ? (
							<AppText color="muted">
								{t("summary.reviews", { count: day.assessmentCount })}
							</AppText>
						) : null}
						{day.healthLabels && day.healthLabels.length > 0 ? (
							<AppText color="muted">
								{t("summary.health", { list: day.healthLabels.join(", ") })}
							</AppText>
						) : null}
						{day.habitLabels && day.habitLabels.length > 0 ? (
							<AppText color="muted">
								{t("summary.habits", { list: day.habitLabels.join(", ") })}
							</AppText>
						) : null}
						{day.challengeLabels && day.challengeLabels.length > 0 ? (
							<AppText color="muted">
								{t("summary.challenges", {
									list: day.challengeLabels.join(", "),
								})}
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
