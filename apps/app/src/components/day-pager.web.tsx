import type { ReactNode } from "react";
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
	onSelectDay: (localDay: string) => void;
	renderDay: (localDay: string) => ReactNode;
};

export function DayPager({
	days,
	selectedDay,
	onSelectDay,
	renderDay,
}: DayPagerProps) {
	const { width } = useWindowDimensions();
	const pageWidth = Math.max(width, 1);
	const selectedIndex = Math.max(0, days.indexOf(selectedDay));

	function handleMomentumScrollEnd(
		event: NativeSyntheticEvent<NativeScrollEvent>,
	) {
		const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
		const localDay = days[index];
		if (localDay && localDay !== selectedDay) onSelectDay(localDay);
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
