import { isCalendarDay, localDayOf } from "@bro/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/empty-state";
import { LoadingScreen, Screen } from "../../components/screen";
import { createIntakeStore, type IntakeStore } from "../../intake/intake-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	IntakeDayContent,
	type IntakeDaySegment,
	isIntakeDaySegment,
} from "./intake-day-content";

type IntakeScreenProps = {
	store?: Pick<IntakeStore, "loadDay" | "updateEvent" | "deleteEvent">;
};

/**
 * The Intake tab: today, read against the user's own usual, with the card's
 * own arrows to walk back through the days.
 *
 * The day on show and the half of the card showing it are route parameters, so
 * finishing a log can hand the tab back opened on the day just logged and on
 * its entries. The loader reads the day through a ref rather than closing over
 * it: keeping its identity means a step back refreshes in place rather than
 * dropping to a spinner.
 */
export function IntakeScreen({ store }: IntakeScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const params = useLocalSearchParams<{ day?: string; view?: string }>();
	const intake = useMemo(() => store ?? createIntakeStore(), [store]);
	const [busy, setBusy] = useState(false);
	const selectedDay =
		typeof params.day === "string" && isCalendarDay(params.day)
			? params.day
			: null;
	const segment: IntakeDaySegment = isIntakeDaySegment(params.view)
		? params.view
		: "summary";
	const selectedDayRef = useRef(selectedDay);
	selectedDayRef.current = selectedDay;
	const loadingDay = useRef(selectedDay ?? localDayOf(new Date()));
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(
		useCallback(() => {
			const day = selectedDayRef.current ?? localDayOf(new Date());
			loadingDay.current = day;
			return intake.loadDay(day);
		}, [intake]),
	);

	useEffect(() => {
		const day = selectedDay ?? localDayOf(new Date());
		if (loadingDay.current === day) return;
		loadingDay.current = day;
		void reload();
	}, [selectedDay, reload]);

	async function mutate(work: () => Promise<unknown>): Promise<boolean> {
		if (busy) return false;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await intake.loadDay(loadingDay.current));
			return true;
		} catch (caught) {
			setError(toMessage(caught));
			return false;
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return <LoadingScreen variant="tab" />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("intake:loadFailed")}
					body={error ?? t("intake:loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="xl">
			<IntakeDayContent
				snapshot={snapshot}
				error={error}
				busy={busy}
				segment={segment}
				onSelectSegment={(next) => router.setParams({ view: next })}
				onSelectDay={(localDay) => router.setParams({ day: localDay })}
				onSaveEvent={(id, edit) => mutate(() => intake.updateEvent(id, edit))}
				onDeleteEvent={(id) => mutate(() => intake.deleteEvent(id))}
			/>
		</Screen>
	);
}

export default IntakeScreen;
