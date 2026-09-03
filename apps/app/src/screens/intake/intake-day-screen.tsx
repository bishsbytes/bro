import { type Href, router, Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/empty-state";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { createIntakeStore, type IntakeStore } from "../../intake/intake-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { IntakeDayContent } from "./intake-day-content";

type IntakeDayScreenProps = {
	localDay: string | null;
	store?: Pick<IntakeStore, "loadDay" | "updateEvent" | "deleteEvent">;
};

/** The tab opened on a chosen day: the same card, arrows, rows, and edit sheet. */
export function IntakeDayScreen({ localDay, store }: IntakeDayScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const intake = useMemo(() => store ?? createIntakeStore(), [store]);
	const [busy, setBusy] = useState(false);
	const selectedDay = useRef(localDay);
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(
		useCallback(() => {
			const day = selectedDay.current;
			return day === null ? Promise.resolve(null) : intake.loadDay(day);
		}, [intake]),
	);

	function selectDay(next: string) {
		selectedDay.current = next;
		void reload();
	}

	async function mutate(work: () => Promise<unknown>): Promise<boolean> {
		const day = selectedDay.current;
		if (busy || day === null) return false;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await intake.loadDay(day));
			return true;
		} catch (caught) {
			setError(toMessage(caught));
			return false;
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("intake:day.notFound")}
					body={error ?? t("intake:day.notFoundBody")}
					actionLabel={t("intake:day.back")}
					onAction={() => router.replace("/intake" as Href)}
				/>
			</Screen>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: snapshot.dayLabel }} />
			<Screen scroll padded gap="xl">
				<IntakeDayContent
					snapshot={snapshot}
					error={error}
					busy={busy}
					onSelectDay={selectDay}
					onSaveEvent={(id, edit) => mutate(() => intake.updateEvent(id, edit))}
					onDeleteEvent={(id) => mutate(() => intake.deleteEvent(id))}
				/>
			</Screen>
		</>
	);
}
