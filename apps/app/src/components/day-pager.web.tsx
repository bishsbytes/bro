import {
	type ComponentProps,
	type ComponentType,
	type ReactNode,
	useLayoutEffect,
	useRef,
} from "react";
import {
	FlatList,
	type FlatListProps,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	useWindowDimensions,
	View,
} from "react-native";
import { StyleSheet } from "../theme/unistyles";

const SCROLL_SETTLE_MS = 150;

type DayCellProps = ComponentProps<
	NonNullable<FlatListProps<string>["CellRendererComponent"]>
>;
// VirtualizedList requires its focus handler to be forwarded, while View's
// native TypeScript surface omits the capture prop that react-native-web uses.
const CellView = View as ComponentType<
	ComponentProps<typeof View> & Pick<DayCellProps, "onFocusCapture">
>;

function DayCell({ children, onFocusCapture, onLayout, style }: DayCellProps) {
	return (
		<CellView
			onFocusCapture={onFocusCapture}
			onLayout={onLayout}
			style={[style, styles.cell]}
		>
			{children}
		</CellView>
	);
}

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
	const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const listRef = useRef<FlatList<string>>(null);

	useLayoutEffect(() => {
		thresholdDay.current = selectedDay;
		if (settleTimer.current) {
			clearTimeout(settleTimer.current);
			settleTimer.current = null;
		}
		// Keep the existing list mounted and move the rebuilt day window before
		// paint. Remounting via a key briefly exposed the empty pager background.
		listRef.current?.scrollToIndex({ animated: false, index: selectedIndex });
		return () => {
			if (settleTimer.current) clearTimeout(settleTimer.current);
		};
	}, [pageWidth, selectedDay, selectedIndex]);

	function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
		const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
		const localDay = days[index];
		if (!localDay) return;

		if (localDay !== thresholdDay.current) {
			thresholdDay.current = localDay;
			onPreviewDay(localDay);
		}

		// react-native-web emits a final onScroll after the browser settles, but
		// does not emit onMomentumScrollEnd. Commit from that settled position so
		// the parent can rebuild this short window around the newly selected day.
		if (settleTimer.current) clearTimeout(settleTimer.current);
		settleTimer.current = setTimeout(() => {
			settleTimer.current = null;
			if (localDay !== selectedDay) onSelectDay(localDay);
		}, SCROLL_SETTLE_MS);
	}

	return (
		<FlatList
			ref={listRef}
			testID="today-day-pager"
			style={styles.pager}
			horizontal
			pagingEnabled
			showsHorizontalScrollIndicator={false}
			data={days}
			// A horizontal VirtualizedList cell otherwise sizes itself from the
			// vertical page content on web. Pinning it to the pager's cross-axis
			// height lets the Screen inside own vertical scrolling.
			CellRendererComponent={DayCell}
			initialScrollIndex={selectedIndex}
			keyExtractor={(localDay) => localDay}
			getItemLayout={(_, index) => ({
				length: pageWidth,
				offset: pageWidth * index,
				index,
			})}
			onScroll={handleScroll}
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
	cell: { height: "100%", minHeight: 0 },
	page: { height: "100%" },
}));
