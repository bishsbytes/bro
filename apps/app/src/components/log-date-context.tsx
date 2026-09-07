import { localDayOf } from "@bro/domain";
import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type DatedTab = "journal" | "intake";
const LogDateContext = createContext({
	days: {} as Partial<Record<DatedTab, string>>,
	setDay: (_tab: DatedTab, _day: string) => {},
});

export function LogDateProvider({ children }: PropsWithChildren) {
	const [days, setDays] = useState<Partial<Record<DatedTab, string>>>({});
	const setDay = useCallback((tab: DatedTab, day: string) => {
		setDays((current) =>
			current[tab] === day ? current : { ...current, [tab]: day },
		);
	}, []);
	const value = useMemo(() => ({ days, setDay }), [days, setDay]);
	return (
		<LogDateContext.Provider value={value}>{children}</LogDateContext.Provider>
	);
}

export function useSetLogDate(tab: DatedTab, day: string) {
	const { setDay } = useContext(LogDateContext);
	useEffect(() => setDay(tab, day), [setDay, tab, day]);
}

export function useLogDate(tab: string) {
	const { days } = useContext(LogDateContext);
	return days[tab as DatedTab] ?? localDayOf(new Date());
}
