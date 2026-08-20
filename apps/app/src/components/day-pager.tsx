import type { ReactNode } from "react";
import { View } from "react-native";
import PagerView, {
	type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { StyleSheet } from "../theme/unistyles";

export type DayPagerProps = {
	days: readonly string[];
	selectedDay: string;
	onSelectDay: (localDay: string) => void;
	renderDay: (localDay: string) => ReactNode;
};

export function DayPager({
	days,
	selectedDay,
	onSelectDay,
	renderDay,
}: DayPagerProps) {
	const selectedIndex = Math.max(0, days.indexOf(selectedDay));

	function handlePageSelected(event: PagerViewOnPageSelectedEvent) {
		const localDay = days[event.nativeEvent.position];
		if (localDay && localDay !== selectedDay) onSelectDay(localDay);
	}

	return (
		<PagerView
			key={selectedDay}
			testID="today-day-pager"
			style={styles.pager}
			initialPage={selectedIndex}
			keyboardDismissMode="on-drag"
			overdrag={false}
			overScrollMode="never"
			offscreenPageLimit={1}
			onPageSelected={handlePageSelected}
		>
			{days.map((localDay) => (
				<View
					key={localDay}
					collapsable={false}
					style={styles.page}
					testID={`today-day-page-${localDay}`}
				>
					{renderDay(localDay)}
				</View>
			))}
		</PagerView>
	);
}

const styles = StyleSheet.create(() => ({
	pager: { flex: 1 },
	page: { width: "100%", height: "100%" },
}));
