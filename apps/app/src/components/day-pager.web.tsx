import { type ReactNode, useEffect, useRef } from "react";
import {
	FlatList,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	useWindowDimensions,
	View,
} from "react-native";
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
	const { width } = useWindowDimensions();
	const pageWidth = Math.max(width, 1);
	const selectedIndex = Math.max(0, days.indexOf(selectedDay));
	const thresholdDay = useRef(selectedDay);

	useEffect(() => {
		thresholdDay.current = selectedDay;
	}, [selectedDay]);

	function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
		const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
		const localDay = days[index];
		if (!localDay || localDay === thresholdDay.current) return;

		thresholdDay.current = localDay;
		onPreviewDay(localDay);
	}

	function handleMomentumScrollEnd(
		event: NativeSyntheticEvent<NativeScrollEvent>,
	) {
		const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
		const localDay = days[index];
		if (!localDay) return;
		if (localDay !== thresholdDay.current) {
			thresholdDay.current = localDay;
			onPreviewDay(localDay);
		}
		if (localDay !== selectedDay) onSelectDay(localDay);
	}

	return (
		<FlatList
			key={selectedDay}
			testID="today-day-pager"
			style={styles.pager}
			horizontal
			pagingEnabled
			showsHorizontalScrollIndicator={false}
			data={days}
			initialScrollIndex={selectedIndex}
			keyExtractor={(localDay) => localDay}
			getItemLayout={(_, index) => ({
				length: pageWidth,
				offset: pageWidth * index,
				index,
			})}
			onScroll={handleScroll}
			onMomentumScrollEnd={handleMomentumScrollEnd}
			renderItem={({ item: localDay }) => (
				<View
					style={[styles.page, { width: pageWidth }]}
					testID={`today-day-page-${localDay}`}
				>
					{renderDay(localDay)}
				</View>
			)}
		/>
	);
}

const styles = StyleSheet.create(() => ({
	pager: { flex: 1 },
	page: { height: "100%" },
}));
