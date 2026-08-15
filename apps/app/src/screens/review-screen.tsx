import type { Assessment } from "@bro/database-app";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";
import { Button } from "../components/button";
import { EmptyState } from "../components/empty-state";
import { ListRow } from "../components/list-row";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import { createReviewStore, type ReviewStore } from "../review/review-store";

type ReviewScreenProps = {
	store?: Pick<ReviewStore, "listSittings">;
};

function completedLabel(assessment: Assessment): string {
	return new Date(
		assessment.completedAt ?? assessment.startedAt,
	).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function ReviewScreen({ store }: ReviewScreenProps) {
	const reviews = useMemo(() => store ?? createReviewStore(), [store]);
	const [sittings, setSittings] = useState<Assessment[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setSittings(await reviews.listSittings());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [reviews]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	if (!sittings && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			<SectionHeader
				title="Review history"
				eyebrow="WHEEL OF LIFE"
				action={
					<Button
						label="Take stock"
						variant="text"
						onPress={() => router.push("/review/new")}
					/>
				}
			/>

			{error ? (
				<EmptyState
					title="Reviews could not be loaded"
					body={error}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			) : null}

			{sittings?.length === 0 ? (
				<EmptyState
					title="No reviews yet"
					body="Rate the areas of your life to see where things stand today."
				/>
			) : null}

			{sittings?.map((assessment) => (
				<ListRow
					key={assessment.id}
					accessibilityLabel={`Open review ${completedLabel(assessment)}`}
					title={completedLabel(assessment)}
					detail={`${assessment.items.length} life areas`}
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
