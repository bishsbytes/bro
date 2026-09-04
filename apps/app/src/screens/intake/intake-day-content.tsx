import { previousLocalDay, shiftLocalDay } from "@bro/domain";
import { INTAKE_BASELINE_MIN_LOGGED_DAYS } from "@bro/logic";
import { type Href, router } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Animated, Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import { BaselineGauge } from "../../components/baseline-gauge";
import { Card } from "../../components/card";
import { Icon } from "../../components/icon";
import { SectionHeader } from "../../components/section-header";
import type {
	IntakeDaySnapshot,
	IntakeEventEdit,
	PresentedIntakeEntry,
} from "../../intake/intake-store";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";
import { IntakeEntrySheet } from "./intake-entry-sheet";
import { IntakeRow, RowPanel } from "./intake-rows";

export type IntakeDaySegment = "summary" | "logged";

export function isIntakeDaySegment(value: unknown): value is IntakeDaySegment {
	return value === "summary" || value === "logged";
}

type IntakeDayContentProps = {
	snapshot: IntakeDaySnapshot;
	error: string | null;
	busy: boolean;
	/** Which half of the card is showing; the parent owns it so a caller can open the day on its entries. */
	segment: IntakeDaySegment;
	onSelectSegment: (segment: IntakeDaySegment) => void;
	onSelectDay: (localDay: string) => void;
	/** Resolves true once the change is saved and the day reloaded. */
	onSaveEvent: (id: string, edit: IntakeEventEdit) => Promise<boolean>;
	onDeleteEvent: (id: string) => Promise<boolean>;
};

/** Two views of one day, switched in place: the totals, or what was logged. */
function Segments({
	value,
	onChange,
}: {
	value: IntakeDaySegment;
	onChange: (segment: IntakeDaySegment) => void;
}) {
	const { t } = useTranslation("intake");
	const segments: { key: IntakeDaySegment; label: string }[] = [
		{ key: "summary", label: t("tab.summary") },
		{ key: "logged", label: t("tab.logged") },
	];
	return (
		<View accessibilityRole="tablist" style={styles.segments}>
			{segments.map((segment, index) => {
				const selected = segment.key === value;
				return (
					<Pressable
						key={segment.key}
						accessibilityRole="tab"
						accessibilityLabel={segment.label}
						accessibilityState={{ selected }}
						hitSlop={4}
						onPress={() => onChange(segment.key)}
						style={({ pressed }) => [
							styles.segment,
							index === 0 ? styles.segmentFirst : styles.segmentLast,
							selected && styles.segmentSelected,
							pressed && styles.segmentPressed,
						]}
					>
						<AppText
							variant="caption"
							color="muted"
							style={selected && styles.segmentSelectedText}
						>
							{segment.label}
						</AppText>
					</Pressable>
				);
			})}
		</View>
	);
}

/**
 * A day of intake as the design draws it, in one card that navigates itself:
 * arrows walk back through the days, and a segmented control switches between
 * one compact baseline gauge per tracked total against the user's own usual
 * and the day's entries as hairline rows on a timeline. Logging is the shared
 * FAB's job. Nothing here is a budget, a remaining amount, or a meal slot.
 */
export function IntakeDayContent({
	snapshot,
	error,
	busy,
	segment,
	onSelectSegment,
	onSelectDay,
	onSaveEvent,
	onDeleteEvent,
}: IntakeDayContentProps) {
	const { t } = useTranslation(["intake", "common"]);
	const { theme } = useUnistyles();
	const [editing, setEditing] = useState<PresentedIntakeEntry | null>(null);
	const transitionOpacity = useRef(new Animated.Value(1)).current;
	const transitionOffset = useRef(new Animated.Value(0)).current;
	const previousSegment = useRef(segment);
	const reducedMotion = useRef(false);
	const rangeNote =
		snapshot.totals.length > 0 &&
		snapshot.totals.some((total) => total.gauge === null);

	useEffect(() => {
		let active = true;
		void AccessibilityInfo.isReduceMotionEnabled()
			.catch(() => true)
			.then((enabled) => {
				if (active) reducedMotion.current = enabled;
			});
		const subscription = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			(enabled) => {
				reducedMotion.current = enabled;
			},
		);
		return () => {
			active = false;
			subscription?.remove();
		};
	}, []);

	useLayoutEffect(() => {
		if (segment === previousSegment.current) return;
		const direction = segment === "logged" ? 1 : -1;
		previousSegment.current = segment;
		if (reducedMotion.current) {
			transitionOpacity.setValue(1);
			transitionOffset.setValue(0);
			return;
		}

		transitionOpacity.setValue(0);
		transitionOffset.setValue(direction * theme.spacing.lg);
		const animation = Animated.parallel([
			Animated.timing(transitionOpacity, {
				toValue: 1,
				duration: theme.motion.duration,
				useNativeDriver: true,
			}),
			Animated.timing(transitionOffset, {
				toValue: 0,
				duration: theme.motion.duration,
				useNativeDriver: true,
			}),
		]);
		animation.start();
		return () => animation.stop();
	}, [
		segment,
		theme.motion.duration,
		theme.spacing.lg,
		transitionOffset,
		transitionOpacity,
	]);

	return (
		<>
			<Card style={styles.hero}>
				<View style={styles.dayHeading}>
					<View style={styles.dayCopy}>
						<AppText variant="section">{snapshot.dayLabel}</AppText>
						{snapshot.dayDate ? (
							<AppText variant="caption" color="muted">
								{snapshot.dayDate}
							</AppText>
						) : null}
					</View>
					<View style={styles.dayNav}>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("intake:tab.previousDay")}
							disabled={busy}
							onPress={() => onSelectDay(previousLocalDay(snapshot.localDay))}
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
							onPress={() => onSelectDay(shiftLocalDay(snapshot.localDay, 1))}
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

				<Segments value={segment} onChange={onSelectSegment} />

				<Animated.View
					style={[
						styles.segmentContent,
						{
							opacity: transitionOpacity,
							transform: [{ translateX: transitionOffset }],
						},
					]}
				>
					{segment === "summary" ? (
						<>
							{snapshot.totals.length === 0 ? (
								<AppText variant="caption" color="muted">
									{t("intake:tab.totalsEmpty")}
								</AppText>
							) : (
								snapshot.totals.map((total) => (
									<BaselineGauge
										key={total.metric.slug}
										label={total.metric.label}
										meta={total.meta}
										value={total.dayValueParts?.value ?? t("common:emDash")}
										unit={total.dayValueParts?.unit ?? null}
										valueVariant="score"
										rail={total.gauge?.rail ?? null}
										railLabels={total.gauge?.railLabels ?? null}
										band={total.gauge?.band ?? null}
										current={total.dayValue}
										previous={null}
										read={total.read}
										domain={total.domain}
										accessibilityLabel={t("intake:read.gaugeA11y", {
											name: total.metric.label,
											value: total.dayFormatted ?? t("common:emDash"),
											read: total.read ?? "",
										}).trim()}
									/>
								))
							)}
							{rangeNote ? (
								<AppText variant="caption" color="muted">
									{t("intake:tab.rangeNote", {
										count: INTAKE_BASELINE_MIN_LOGGED_DAYS,
									})}
								</AppText>
							) : null}
							<AppText variant="caption" color="subtle">
								{t("intake:tab.disclaimer")}
							</AppText>
						</>
					) : snapshot.entries.length === 0 ? (
						<View style={styles.empty}>
							<AppText variant="label">
								{t(
									snapshot.isToday
										? "intake:tab.emptyTitle"
										: "intake:day.emptyTitle",
								)}
							</AppText>
							<AppText variant="caption" color="muted">
								{t(
									snapshot.isToday
										? "intake:tab.emptyBody"
										: "intake:day.emptyBody",
								)}
							</AppText>
						</View>
					) : (
						<View testID="intake-entries">
							<AppText variant="micro" color="subtle">
								{t("intake:tab.entryCount", {
									count: snapshot.events.length,
								})}
							</AppText>
							{snapshot.entries.map((entry, index) => (
								<IntakeRow
									key={entry.key}
									leading={entry.time}
									title={entry.name}
									meta={entry.meta}
									value={entry.value || null}
									last={index === snapshot.entries.length - 1}
									disabled={busy}
									accessibilityLabel={entry.accessibilityLabel}
									accessibilityHint={t("intake:entry.editHint")}
									onPress={() => setEditing(entry)}
								/>
							))}
						</View>
					)}
				</Animated.View>
			</Card>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader title={t("intake:tab.manageTitle")} />
				<RowPanel>
					<IntakeRow
						title={t("intake:tab.library")}
						meta={t("intake:tab.libraryDetail")}
						chevron
						onPress={() => router.push("/intake/library" as Href)}
					/>
					<IntakeRow
						title={t("intake:tab.goals")}
						meta={t("intake:tab.goalsDetail")}
						chevron
						onPress={() => router.push("/intake/goals" as Href)}
					/>
					<IntakeRow
						title={t("intake:tab.settings")}
						meta={t("intake:tab.settingsDetail")}
						chevron
						last
						onPress={() => router.push("/settings/intake" as Href)}
					/>
				</RowPanel>
			</View>

			<IntakeEntrySheet
				entry={editing}
				busy={busy}
				onSave={(id, edit) => {
					void onSaveEvent(id, edit).then((saved) => {
						if (saved) setEditing(null);
					});
				}}
				onDelete={(id) => {
					void onDeleteEvent(id).then((deleted) => {
						if (deleted) setEditing(null);
					});
				}}
				onClose={() => setEditing(null)}
			/>
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	hero: { gap: theme.spacing.lg },
	dayHeading: {
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
		borderWidth: 1,
		borderColor: theme.colors.lineStrong,
		borderRadius: theme.radius.md,
	},
	navButtonPressed: { backgroundColor: theme.colors.surfaceSunk },
	navButtonDisabled: { opacity: theme.opacity.disabled },
	segments: {
		flexDirection: "row",
		width: "100%",
	},
	segment: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.border,
		backgroundColor: theme.colors.surface,
		paddingVertical: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
	},
	segmentFirst: {
		borderTopLeftRadius: theme.radius.md,
		borderBottomLeftRadius: theme.radius.md,
	},
	segmentLast: {
		marginLeft: -1,
		borderTopRightRadius: theme.radius.md,
		borderBottomRightRadius: theme.radius.md,
	},
	segmentSelected: {
		zIndex: 1,
		borderColor: theme.colors.brand,
		backgroundColor: theme.colors.selected,
	},
	segmentSelectedText: { color: theme.colors.onSelected },
	segmentPressed: { opacity: theme.opacity.disabled },
	segmentContent: { gap: theme.spacing.lg },
	empty: { gap: theme.spacing.xs, paddingVertical: theme.spacing.sm },
	section: { gap: theme.spacing.md },
}));
