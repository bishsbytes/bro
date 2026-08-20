import { type ReactNode, useEffect, useRef } from "react";
import { View } from "react-native";
import PagerView, {
	type PagerViewOnPageScrollEvent,
	type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { playSelectionHaptic } from "../feedback/selection-haptic";
import { StyleSheet } from "../theme/unistyles";

export type DayPagerProps = {
	days: readonly string[];
	selectedDay: string;
	onPreviewDay: (localDay: string) => void;
	onSelectDay: (localDay: string) => void;
	renderDay: (localDay: string) => ReactNode;
};

export function DayPager({
	days,
	selectedDay,
	onPreviewDay,
	onSelectDay,
	renderDay,
}: DayPagerProps) {
	const selectedIndex = Math.max(0, days.indexOf(selectedDay));
	const thresholdDay = useRef(selectedDay);

	useEffect(() => {
		thresholdDay.current = selectedDay;
	}, [selectedDay]);

	function handlePageScroll(event: PagerViewOnPageScrollEvent) {
		const { offset, position } = event.nativeEvent;
		const thresholdIndex = position + (offset >= 0.5 ? 1 : 0);
		const localDay = days[thresholdIndex];
		if (!localDay || localDay === thresholdDay.current) return;

		thresholdDay.current = localDay;
		playSelectionHaptic();
		onPreviewDay(localDay);
	}

	function handlePageSelected(event: PagerViewOnPageSelectedEvent) {
		const localDay = days[event.nativeEvent.position];
		if (!localDay) return;

		if (localDay !== thresholdDay.current) {
			thresholdDay.current = localDay;
			playSelectionHaptic();
			onPreviewDay(localDay);
		}
		if (localDay !== selectedDay) onSelectDay(localDay);
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
			onPageScroll={handlePageScroll}
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
