import { previousLocalDay, shiftLocalDay } from "@bro/domain";
import { INTAKE_BASELINE_MIN_LOGGED_DAYS } from "@bro/logic";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
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

type Segment = "summary" | "logged";

type IntakeDayContentProps = {
	snapshot: IntakeDaySnapshot;
	error: string | null;
	busy: boolean;
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
	value: Segment;
	onChange: (segment: Segment) => void;
}) {
	const { t } = useTranslation("intake");
	const segments: { key: Segment; label: string }[] = [
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
						onPress={() => onChange(segment.key)}
						style={[
							styles.segment,
							index > 0 && styles.segmentDivider,
							selected && styles.segmentSelected,
						]}
					>
						<AppText variant="label" color={selected ? "onBrand" : "muted"}>
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
	onSelectDay,
	onSaveEvent,
	onDeleteEvent,
}: IntakeDayContentProps) {
	const { t } = useTranslation(["intake", "common"]);
	const { theme } = useUnistyles();
	const [segment, setSegment] = useState<Segment>("summary");
	const [editing, setEditing] = useState<PresentedIntakeEntry | null>(null);
	const rangeNote =
		snapshot.totals.length > 0 &&
		snapshot.totals.some((total) => total.gauge === null);

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

				<Segments value={segment} onChange={setSegment} />

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
							{t("intake:tab.entryCount", { count: snapshot.events.length })}
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
		borderWidth: 1,
		borderColor: theme.colors.lineStrong,
		borderRadius: theme.radius.md,
		overflow: "hidden",
	},
	segment: {
		flex: 1,
		minHeight: theme.control.buttonMinHeight,
		alignItems: "center",
		justifyContent: "center",
	},
	segmentDivider: {
		borderLeftWidth: 1,
		borderLeftColor: theme.colors.lineStrong,
	},
	segmentSelected: { backgroundColor: theme.colors.accent },
	empty: { gap: theme.spacing.xs, paddingVertical: theme.spacing.sm },
	section: { gap: theme.spacing.md },
}));
