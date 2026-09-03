import { localDayOf } from "@bro/domain";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/empty-state";
import { LoadingScreen, Screen } from "../../components/screen";
import { createIntakeStore, type IntakeStore } from "../../intake/intake-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { IntakeDayContent } from "./intake-day-content";

type IntakeScreenProps = {
	store?: Pick<IntakeStore, "loadDay" | "updateEvent" | "deleteEvent">;
};

/**
 * The Intake tab: today, read against the user's own usual, with the card's
 * own arrows to walk back through the days. The chosen day lives in a ref so
 * the loader keeps its identity and a step back refreshes in place rather
 * than dropping to a spinner.
 */
export function IntakeScreen({ store }: IntakeScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const intake = useMemo(() => store ?? createIntakeStore(), [store]);
	const [busy, setBusy] = useState(false);
	const selectedDay = useRef(localDayOf(new Date()));
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(
		useCallback(() => intake.loadDay(selectedDay.current), [intake]),
	);

	function selectDay(localDay: string) {
		selectedDay.current = localDay;
		void reload();
	}

	async function mutate(work: () => Promise<unknown>): Promise<boolean> {
		if (busy) return false;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await intake.loadDay(selectedDay.current));
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
				onSelectDay={selectDay}
				onSaveEvent={(id, edit) => mutate(() => intake.updateEvent(id, edit))}
				onDeleteEvent={(id) => mutate(() => intake.deleteEvent(id))}
			/>
		</Screen>
	);
}

export default IntakeScreen;
