import { shiftLocalDay, type WeekStartDay, weekStartOf } from "@bro/domain";
import { formatLocalDayLabel } from "@bro/logic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	FlatList,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	Pressable,
	useWindowDimensions,
	View,
} from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";

export type WeekStripDayIndicator = {
	hasCheckIn: boolean;
	habitsScheduled: number;
	habitsCompleted: number;
};

export type WeekStripProps = {
	todayLocalDay: string;
	selectedDay: string;
	weekStart: WeekStartDay;
	indicators: ReadonlyMap<string, WeekStripDayIndicator>;
	onSelectDay: (localDay: string) => void;
	onVisibleRangeChange: (fromLocalDay: string, throughLocalDay: string) => void;
};

type WeekPage = {
	start: string;
	through: string;
	days: string[];
};

const INITIAL_WEEK_COUNT = 8;
const WEEK_EXTENSION_COUNT = 8;
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
	weekday: "narrow",
	timeZone: "UTC",
});
const DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	timeZone: "UTC",
});
const WEEK_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

function buildWeek(start: string): WeekPage {
	const days = Array.from({ length: 7 }, (_, index) =>
		shiftLocalDay(start, index),
	);
	return { start, through: days[6], days };
}

function buildWeeks(currentWeekStart: string, count: number): WeekPage[] {
	return Array.from({ length: count }, (_, index) =>
		buildWeek(shiftLocalDay(currentWeekStart, index * -7)),
	);
}

function dateOf(localDay: string): Date {
	return new Date(`${localDay}T00:00:00.000Z`);
}

function weekdayInitial(localDay: string): string {
	return WEEKDAY_FORMATTER.format(dateOf(localDay));
}

function dayNumber(localDay: string): string {
	return DAY_NUMBER_FORMATTER.format(dateOf(localDay));
}

function weekAccessibilityLabel(localDay: string): string {
	return `Week of ${WEEK_LABEL_FORMATTER.format(dateOf(localDay))}`;
}

function dayAccessibilityLabel(
	localDay: string,
	todayLocalDay: string,
	indicator: WeekStripDayIndicator,
	formattedDay = formatLocalDayLabel(localDay, todayLocalDay),
): string {
	const checkIn = indicator.hasCheckIn ? "check-in logged" : "no check-in";
	const habits =
		indicator.habitsScheduled === 0
			? "no habits scheduled"
			: `${indicator.habitsCompleted} of ${indicator.habitsScheduled} habits done`;
	return `${formattedDay}, ${checkIn}, ${habits}`;
}

export function WeekStrip({
	todayLocalDay,
	selectedDay,
	weekStart,
	indicators,
	onSelectDay,
	onVisibleRangeChange,
}: WeekStripProps) {
	const { width } = useWindowDimensions();
	const { theme } = useUnistyles();
	const pageWidth = Math.max(width, 1);
	const currentWeekStart = weekStartOf(todayLocalDay, weekStart);
	const [weekCount, setWeekCount] = useState(INITIAL_WEEK_COUNT);
	const [visibleWeekIndex, setVisibleWeekIndex] = useState(0);
	const weeks = useMemo(
		() => buildWeeks(currentWeekStart, weekCount),
		[currentWeekStart, weekCount],
	);
	const dayPresentation = useMemo(() => {
		const presentation = new Map<
			string,
			{ weekday: string; number: string; accessibilityLabel: string }
		>();
		for (const week of weeks) {
			for (const localDay of week.days) {
				presentation.set(localDay, {
					weekday: weekdayInitial(localDay),
					number: dayNumber(localDay),
					accessibilityLabel: formatLocalDayLabel(localDay, todayLocalDay),
				});
			}
		}
		return presentation;
	}, [todayLocalDay, weeks]);

	useEffect(() => {
		setWeekCount(INITIAL_WEEK_COUNT);
		setVisibleWeekIndex(0);
		onVisibleRangeChange(currentWeekStart, shiftLocalDay(currentWeekStart, 6));
	}, [currentWeekStart, onVisibleRangeChange]);

	const reportVisibleWeek = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			const rawIndex = Math.round(
				event.nativeEvent.contentOffset.x / pageWidth,
			);
			const index = Math.max(0, Math.min(rawIndex, weeks.length - 1));
			const week = weeks[index];
			if (week) {
				setVisibleWeekIndex(index);
				onVisibleRangeChange(week.start, week.through);
			}
		},
		[onVisibleRangeChange, pageWidth, weeks],
	);

	return (
		<FlatList
			key={currentWeekStart}
			testID="week-strip"
			accessibilityLabel={weekAccessibilityLabel(
				weeks[visibleWeekIndex]?.start ?? currentWeekStart,
			)}
			horizontal
			pagingEnabled
			showsHorizontalScrollIndicator={false}
			data={weeks}
			keyExtractor={(week) => week.start}
			getItemLayout={(_, index) => ({
				length: pageWidth,
				offset: pageWidth * index,
				index,
			})}
			onMomentumScrollEnd={reportVisibleWeek}
			onEndReached={() => setWeekCount((count) => count + WEEK_EXTENSION_COUNT)}
			onEndReachedThreshold={0.5}
			style={styles.list}
			renderItem={({ item: week }) => (
				<View style={[styles.week, { width: pageWidth }]}>
					{week.days.map((localDay) => {
						const indicator = indicators.get(localDay) ?? {
							hasCheckIn: false,
							habitsScheduled: 0,
							habitsCompleted: 0,
						};
						const selected = localDay === selectedDay;
						const future = localDay > todayLocalDay;
						const presentation = dayPresentation.get(localDay);
						const adherence =
							indicator.habitsScheduled === 0
								? "none"
								: indicator.habitsCompleted >= indicator.habitsScheduled
									? "complete"
									: indicator.habitsCompleted > 0
										? "partial"
										: "empty";
						return (
							<Pressable
								key={localDay}
								testID={`week-strip-day-${localDay}`}
								accessibilityRole="button"
								accessibilityLabel={dayAccessibilityLabel(
									localDay,
									todayLocalDay,
									indicator,
									presentation?.accessibilityLabel,
								)}
								accessibilityState={{ selected, disabled: future }}
								disabled={future}
								onPress={() => onSelectDay(localDay)}
								style={[
									styles.day,
									selected && styles.selectedDay,
									future && styles.futureDay,
								]}
							>
								<AppText variant="micro" color="muted">
									{presentation?.weekday ?? weekdayInitial(localDay)}
								</AppText>
								<AppText
									variant="label"
									style={localDay === todayLocalDay && styles.todayNumber}
								>
									{presentation?.number ?? dayNumber(localDay)}
								</AppText>
								<View style={styles.indicators}>
									<View
										testID={`week-strip-check-in-${localDay}`}
										style={[
											styles.checkIn,
											indicator.hasCheckIn && {
												backgroundColor: theme.colors.brand,
												borderColor: theme.colors.brand,
											},
										]}
									/>
									{adherence !== "none" ? (
										<View
											testID={`week-strip-adherence-${localDay}`}
											style={[
												styles.adherence,
												adherence === "partial" && {
													borderColor: theme.colors.textMuted,
												},
												adherence === "complete" && {
													borderColor: theme.colors.brand,
												},
											]}
										/>
									) : null}
								</View>
							</Pressable>
						);
					})}
				</View>
			)}
		/>
	);
}

const styles = StyleSheet.create((theme) => ({
	list: {
		flexGrow: 0,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.headerBorder,
		backgroundColor: theme.colors.headerBackground,
	},
	week: {
		flexDirection: "row",
		paddingHorizontal: theme.spacing.sm,
		paddingVertical: theme.spacing.sm,
	},
	day: {
		flex: 1,
		minHeight: 66,
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing.xs,
		borderRadius: theme.radius.sm,
	},
	selectedDay: { backgroundColor: theme.colors.selected },
	futureDay: { opacity: theme.opacity.disabled },
	todayNumber: { fontWeight: "700" },
	indicators: {
		minHeight: 8,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.xs,
	},
	checkIn: {
		width: 7,
		height: 7,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.pill,
	},
	adherence: {
		width: 8,
		height: 8,
		borderWidth: 2,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.pill,
	},
}));
