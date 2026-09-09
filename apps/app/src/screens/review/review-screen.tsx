import type { Assessment } from "@bro/database-app";
import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { TextAction } from "../../components/text-action";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	assessmentDate,
	formatReviewDate,
} from "../../review/review-presentation";
import {
	createReviewStore,
	type GoalProgress,
	type ReviewStore,
} from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";
import { HeadingCard } from "../life/heading-card";

type ReviewScreenProps = {
	store?: Pick<ReviewStore, "loadOverview">;
};

function completedLabel(assessment: Assessment): string {
	return formatReviewDate(assessmentDate(assessment), "short");
}

export function ReviewScreen({ store }: ReviewScreenProps) {
	// "review" leads, so unprefixed keys resolve there; "common" is declared so
	// shared copy can be reached with an explicit `common:` prefix.
	const { t } = useTranslation(["review", "common"]);
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const {
		data: overview,
		error,
		loading,
		reload,
	} = useFocusStoreLoad(useCallback(() => reviews.loadOverview(), [reviews]));

	const headingAim = (progress: GoalProgress): string =>
		progress.targetFormatted === null
			? (progress.goal.intent ?? t("goals.noTarget"))
			: t("goals.summary", {
					start:
						progress.startFormatted === null
							? t("goals.startValueUnknown")
							: t("goals.startValue", { value: progress.startFormatted }),
					current:
						progress.currentFormatted === null
							? t("goals.currentValueUnknown")
							: t("goals.currentValue", { value: progress.currentFormatted }),
					target: t("goals.targetValue", { value: progress.targetFormatted }),
				});

	if (loading) {
		return <LoadingScreen />;
	}

	return (
		<Screen scroll padded gap="lg">
			{overview && overview.goals.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader
						title={t("goals.title")}
						eyebrow={t("goals.eyebrow")}
					/>
					{overview.goals.map((progress) => (
						<HeadingCard
							key={progress.goal.id}
							label={progress.label}
							status={progress.status}
							statusLabel={t(`goals.status.${progress.status}`)}
							summary={headingAim(progress)}
							detail={
								progress.goal.targetDate
									? t("goals.targetDate", { date: progress.goal.targetDate })
									: null
							}
							onPress={() =>
								router.push({
									pathname: "/headings/[id]",
									params: { id: progress.goal.id },
								})
							}
						/>
					))}
				</View>
			) : null}

			<SectionHeader
				title={t("history.title")}
				eyebrow={t("history.eyebrow")}
				action={
					<TextAction
						label={t("history.takeStock")}
						accessibilityLabel={t("history.takeStock")}
						onPress={() => router.push("/review/new")}
					/>
				}
			/>

			{error ? (
				<EmptyState
					title={t("history.loadFailed")}
					body={error}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			) : null}

			{overview?.sittings.length === 0 ? (
				<EmptyState
					title={t("history.emptyTitle")}
					body={t("history.emptyBody")}
				/>
			) : null}

			{overview?.sittings.map((assessment) => (
				<ListRow
					key={assessment.id}
					accessibilityLabel={t("history.open", {
						date: completedLabel(assessment),
					})}
					title={completedLabel(assessment)}
					detail={t("history.lifeAreas", { count: assessment.items.length })}
					onPress={() =>
						router.push({
							pathname: "/review/[id]",
							params: { id: assessment.id },
						})
					}
				/>
			))}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
}));
