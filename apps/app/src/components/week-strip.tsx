import { shiftLocalDay, type WeekStartDay, weekStartOf } from "@bro/domain";
import { formatLocalDayLabel } from "@bro/logic";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
	resetToTodayCount?: number;
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
	weekday: "short",
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
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1_000;

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

function weekdayLabel(localDay: string): string {
	const formatted = WEEKDAY_FORMATTER.format(dateOf(localDay)).replace(".", "");
	return Array.from(formatted).slice(0, 2).join("");
}

function dayNumber(localDay: string): string {
	return DAY_NUMBER_FORMATTER.format(dateOf(localDay));
}

function weekAccessibilityLabel(
	t: TFunction<"common">,
	localDay: string,
): string {
	return t("a11y.weekOf", {
		date: WEEK_LABEL_FORMATTER.format(dateOf(localDay)),
	});
}

function dayAccessibilityLabel(
	t: TFunction<"common">,
	localDay: string,
	todayLocalDay: string,
	indicator: WeekStripDayIndicator,
	formattedDay = formatLocalDayLabel(localDay, todayLocalDay),
): string {
	const checkIn = indicator.hasCheckIn
		? t("a11y.checkInLogged")
		: t("a11y.noCheckIn");
	const habits =
		indicator.habitsScheduled === 0
			? t("a11y.noHabitsScheduled")
			: t("a11y.habitsDone", {
					done: indicator.habitsCompleted,
					scheduled: indicator.habitsScheduled,
				});
	return t("a11y.daySummary", { day: formattedDay, checkIn, habits });
}

export function WeekStrip({
	todayLocalDay,
	selectedDay,
	resetToTodayCount = 0,
	weekStart,
	indicators,
	onSelectDay,
	onVisibleRangeChange,
}: WeekStripProps) {
	const { t } = useTranslation("common");
	const { width } = useWindowDimensions();
	const { theme } = useUnistyles();
	const pageWidth = Math.max(width, 1);
	const currentWeekStart = weekStartOf(todayLocalDay, weekStart);
	const selectedWeekStart = weekStartOf(selectedDay, weekStart);
	const selectedPositionKey = `${currentWeekStart}:${selectedDay}`;
	const [weekCount, setWeekCount] = useState(INITIAL_WEEK_COUNT);
	const [visibleWeekIndex, setVisibleWeekIndex] = useState(0);
	const listRef = useRef<FlatList<WeekPage>>(null);
	const previousSelectedPositionKey = useRef(selectedPositionKey);
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
					weekday: weekdayLabel(localDay),
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
	}, [currentWeekStart, onVisibleRangeChange, resetToTodayCount]);

	useEffect(() => {
		if (previousSelectedPositionKey.current === selectedPositionKey) return;

		const index = Math.round(
			(dateOf(currentWeekStart).getTime() -
				dateOf(selectedWeekStart).getTime()) /
				MILLISECONDS_PER_WEEK,
		);
		if (index < 0) return;
		if (index >= weekCount) {
			setWeekCount(index + WEEK_EXTENSION_COUNT);
			return;
		}

		previousSelectedPositionKey.current = selectedPositionKey;
		listRef.current?.scrollToIndex({ animated: true, index });
		setVisibleWeekIndex(index);
		onVisibleRangeChange(
			selectedWeekStart,
			shiftLocalDay(selectedWeekStart, 6),
		);
	}, [
		currentWeekStart,
		onVisibleRangeChange,
		selectedPositionKey,
		selectedWeekStart,
		weekCount,
	]);

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
			ref={listRef}
			key={`${currentWeekStart}:${resetToTodayCount}`}
			testID="week-strip"
			accessibilityLabel={weekAccessibilityLabel(
				t,
				weeks[visibleWeekIndex]?.start ?? currentWeekStart,
			)}
			horizontal
			inverted
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
									t,
									localDay,
									todayLocalDay,
									indicator,
									presentation?.accessibilityLabel,
								)}
								accessibilityState={{ selected, disabled: future }}
								disabled={future}
								onPress={() => onSelectDay(localDay)}
								style={[styles.day, future && styles.futureDay]}
							>
								<AppText
									variant="micro"
									color={selected ? "brand" : "subtle"}
									style={selected && styles.selectedText}
								>
									{presentation?.weekday ?? weekdayLabel(localDay)}
								</AppText>
								<AppText
									variant="label"
									color={selected ? "brand" : "subtle"}
									style={[
										localDay === todayLocalDay && styles.todayNumber,
										selected && styles.selectedText,
									]}
								>
									{presentation?.number ?? dayNumber(localDay)}
								</AppText>
								<View style={styles.indicators}>
									<View
										testID={`week-strip-check-in-${localDay}`}
										style={[
											styles.checkIn,
											indicator.hasCheckIn && {
												backgroundColor: theme.colors.mind,
												borderColor: theme.colors.mind,
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
													backgroundColor: theme.colors.body,
													borderColor: theme.colors.body,
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
		paddingVertical: theme.spacing.xs,
	},
	day: {
		flex: 1,
		minHeight: 54,
		alignItems: "center",
		justifyContent: "center",
		gap: 2,
	},
	selectedText: { fontWeight: "700" },
	futureDay: { opacity: theme.opacity.disabled },
	todayNumber: { fontWeight: "700" },
	indicators: {
		position: "absolute",
		bottom: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.xs,
	},
	checkIn: {
		width: 5,
		height: 5,
		borderWidth: 1,
		borderColor: theme.colors.lineStrong,
		borderStyle: "dashed",
		borderRadius: theme.radius.pill,
	},
	adherence: {
		width: 6,
		height: 6,
		borderWidth: 1.5,
		borderColor: theme.colors.lineStrong,
		borderStyle: "dashed",
		borderRadius: theme.radius.pill,
	},
}));
