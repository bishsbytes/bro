import { localDayOf } from "@bro/domain";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

const SetVisibleMonthDayContext = createContext<(localDay: string) => void>(
	() => undefined,
);
const TodayHeaderMonthContext = createContext("");

export function monthHeaderLabel(localDay: string, locale?: string): string {
	return new Intl.DateTimeFormat(locale, {
		month: "long",
		timeZone: "UTC",
	}).format(new Date(`${localDay}T00:00:00.000Z`));
}

export function TodayHeaderMonthProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [title, setTitle] = useState(() =>
		monthHeaderLabel(localDayOf(new Date())),
	);
	const setVisibleMonthDay = useCallback(
		(localDay: string) => setTitle(monthHeaderLabel(localDay)),
		[],
	);
	return (
		<SetVisibleMonthDayContext.Provider value={setVisibleMonthDay}>
			<TodayHeaderMonthContext.Provider value={title}>
				{children}
			</TodayHeaderMonthContext.Provider>
		</SetVisibleMonthDayContext.Provider>
	);
}

export function useSetTodayHeaderVisibleMonthDay() {
	return useContext(SetVisibleMonthDayContext);
}

export function useTodayHeaderMonth() {
	return useContext(TodayHeaderMonthContext);
}
