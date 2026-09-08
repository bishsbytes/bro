import {
	isCalendarDay,
	localDayOf,
	previousLocalDay,
	shiftLocalDay,
} from "@bro/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { useSetLogDate } from "../../components/log-date-context";
import { LoadingScreen, Screen } from "../../components/screen";
import { playSelectionHaptic } from "../../feedback/selection-haptic";
import { createIntakeStore, type IntakeStore } from "../../intake/intake-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";
import {
	IntakeDayContent,
	type IntakeDaySegment,
	isIntakeDaySegment,
} from "./intake-day-content";

type IntakeScreenProps = {
	store?: Pick<IntakeStore, "loadDay" | "updateEvent" | "deleteEvent">;
};

/**
 * The Intake tab: today, read against the user's own usual, with
 * header arrows to walk back through the days.
 *
 * The day on show and the half of the card showing it are route parameters, so
 * finishing a log can hand the tab back opened on the day just logged and on
 * its entries. The loader reads the day through a ref rather than closing over
 * it: keeping its identity means a step back refreshes in place rather than
 * dropping to a spinner.
 */
export function IntakeScreen({ store }: IntakeScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const { theme } = useUnistyles();
	const params = useLocalSearchParams<{ day?: string; view?: string }>();
	const intake = useMemo(() => store ?? createIntakeStore(), [store]);
	const [busy, setBusy] = useState(false);
	const selectedDay =
		typeof params.day === "string" && isCalendarDay(params.day)
			? params.day
			: null;
	const segment: IntakeDaySegment = isIntakeDaySegment(params.view)
		? params.view
		: "logged";
	useSetLogDate("intake", selectedDay ?? localDayOf(new Date()));
	const selectedDayRef = useRef(selectedDay);
	selectedDayRef.current = selectedDay;
	const loadingDay = useRef(selectedDay ?? localDayOf(new Date()));
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(
		useCallback(() => {
			const day = selectedDayRef.current ?? localDayOf(new Date());
			loadingDay.current = day;
			return intake.loadDay(day);
		}, [intake]),
	);

	useEffect(() => {
		const day = selectedDay ?? localDayOf(new Date());
		if (loadingDay.current === day) return;
		loadingDay.current = day;
		void reload();
	}, [selectedDay, reload]);

	async function mutate(work: () => Promise<unknown>): Promise<boolean> {
		if (busy) return false;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await intake.loadDay(loadingDay.current));
			return true;
		} catch (caught) {
			setError(toMessage(caught));
			return false;
		} finally {
			setBusy(false);
		}
	}

	const selectSegment = useCallback(
		(next: IntakeDaySegment) => {
			if (next === segment) return;
			playSelectionHaptic();
			router.setParams({ view: next });
		},
		[segment],
	);

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
		<View style={styles.intake}>
			<View style={styles.dayHeading}>
				<View style={styles.dayCopy}>
					<AppText variant="title">{snapshot.dayLabel}</AppText>
				</View>
				<View style={styles.dayNav}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("intake:tab.previousDay")}
						disabled={busy}
						onPress={() =>
							router.setParams({ day: previousLocalDay(snapshot.localDay) })
						}
						style={({ pressed }) => [
							styles.navButton,
							pressed && styles.navButtonPressed,
						]}
					>
						<Icon name="chevron-left" size={24} color={theme.colors.ink} />
					</Pressable>
					{/* The future is not loggable, so the arrow stops at today. */}
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("intake:tab.nextDay")}
						accessibilityState={{ disabled: snapshot.isToday }}
						disabled={busy || snapshot.isToday}
						onPress={() =>
							router.setParams({ day: shiftLocalDay(snapshot.localDay, 1) })
						}
						style={({ pressed }) => [
							styles.navButton,
							pressed && styles.navButtonPressed,
							snapshot.isToday && styles.navButtonDisabled,
						]}
					>
						<Icon name="chevron-right" size={24} color={theme.colors.ink} />
					</Pressable>
				</View>
			</View>
			<Screen scroll padded gap="xl" contentContainerStyle={styles.content}>
				<IntakeDayContent
					snapshot={snapshot}
					error={error}
					busy={busy}
					segment={segment}
					onSelectSegment={selectSegment}
					onSaveEvent={(id, edit) => mutate(() => intake.updateEvent(id, edit))}
					onDeleteEvent={(id) => mutate(() => intake.deleteEvent(id))}
				/>
			</Screen>
		</View>
	);
}

export default IntakeScreen;

const styles = StyleSheet.create((theme) => ({
	content: { paddingBottom: theme.control.fabClearance },
	intake: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
	dayHeading: {
		paddingHorizontal: theme.spacing.gutter,
		paddingVertical: theme.spacing.sm,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
	dayCopy: { flex: 1, gap: theme.spacing.xs },
	dayNav: { flexDirection: "row", gap: theme.spacing.sm },
	navButton: {
		width: theme.control.buttonMinHeight,
		height: theme.control.buttonMinHeight,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.pill,
	},
	navButtonPressed: { backgroundColor: theme.colors.surfaceSunk },
	navButtonDisabled: { opacity: theme.opacity.disabled },
}));
