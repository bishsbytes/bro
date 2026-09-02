import { Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import type { GaugeRange } from "../../components/baseline-gauge";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

export type MeasurementChange = {
	slug: string;
	label: string;
	/** Only tape-site rows control the compact gauge. */
	selectable: boolean;
	/** When the reading it is compared against was taken, e.g. "since 3 Aug". */
	since: string | null;
	/** The change itself, signed and in the user's units, or a stand-in for none. */
	change: string;
	rail: GaugeRange | null;
	band: GaugeRange | null;
	current: number | null;
	previous: number | null;
	accessibilityLabel: string;
};

type MeasurementChangeListProps = {
	changes: readonly MeasurementChange[];
	selectedSlug: string | null;
	onSelect: (slug: string) => void;
	onOpen: (slug: string) => void;
};

const MARK_SIZE = 9;

function position(value: number, rail: GaugeRange): number {
	if (rail.max <= rail.min) return 50;
	const fraction = (value - rail.min) / (rail.max - rail.min);
	return Math.min(100, Math.max(0, fraction * 100));
}

/**
 * One line per measurement: a dumbbell from the previous reading to this one,
 * and how far it moved.
 *
 * The change is typeset in ink with a sign and nothing else. For one man a
 * falling waist is the point and for another it is gaining mass, so a direction
 * is not a result: no red, no green, no arrows.
 */
export function MeasurementChangeList({
	changes,
	selectedSlug,
	onSelect,
	onOpen,
}: MeasurementChangeListProps) {
	const { theme } = useUnistyles();

	return (
		<View style={styles.rows}>
			{changes.map((change) => {
				const selected = change.slug === selectedSlug;
				return (
					<Pressable
						key={change.slug}
						accessibilityRole="button"
						accessibilityState={change.selectable ? { selected } : undefined}
						accessibilityLabel={change.accessibilityLabel}
						onPress={() =>
							change.selectable ? onSelect(change.slug) : onOpen(change.slug)
						}
						style={[styles.row, selected && styles.rowSelected]}
					>
						<View style={styles.name}>
							<AppText
								variant="label"
								color={selected ? "body" : "default"}
								numberOfLines={1}
							>
								{change.label}
							</AppText>
							{change.since ? (
								<AppText variant="micro" color="subtle" numberOfLines={1}>
									{change.since}
								</AppText>
							) : null}
						</View>
						<View style={styles.dumbbell}>
							<View style={styles.track} />
							{change.rail && change.band ? (
								<View
									style={[
										styles.band,
										{
											backgroundColor: theme.colors.body,
											left: `${position(change.band.min, change.rail)}%`,
											width: `${Math.max(
												position(change.band.max, change.rail) -
													position(change.band.min, change.rail),
												0,
											)}%`,
										},
									]}
								/>
							) : null}
							{change.rail && change.previous !== null ? (
								<View
									style={[
										styles.previous,
										{
											borderColor: theme.colors.body,
											left: `${position(change.previous, change.rail)}%`,
										},
									]}
								/>
							) : null}
							{change.rail && change.current !== null ? (
								<View
									style={[
										styles.current,
										{
											backgroundColor: theme.colors.body,
											left: `${position(change.current, change.rail)}%`,
										},
									]}
								/>
							) : null}
						</View>
						<AppText variant="caption" style={styles.change}>
							{change.change}
						</AppText>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	rows: { borderTopWidth: 1, borderTopColor: theme.colors.line },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
		minHeight: theme.control.buttonMinHeight,
		paddingVertical: theme.spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.line,
	},
	rowSelected: { backgroundColor: theme.colors.surfaceSunk },
	name: { width: 96 },
	dumbbell: { flex: 1, height: MARK_SIZE + 4, justifyContent: "center" },
	track: { height: 1, backgroundColor: theme.colors.line },
	band: {
		position: "absolute",
		top: 0,
		bottom: 0,
		opacity: theme.opacity.domainTint,
	},
	previous: {
		position: "absolute",
		width: MARK_SIZE,
		height: MARK_SIZE,
		marginLeft: -MARK_SIZE / 2,
		borderRadius: MARK_SIZE / 2,
		borderWidth: 1.5,
		backgroundColor: theme.colors.surface,
		opacity: 0.75,
	},
	current: {
		position: "absolute",
		width: MARK_SIZE,
		height: MARK_SIZE,
		marginLeft: -MARK_SIZE / 2,
		borderRadius: MARK_SIZE / 2,
	},
	change: {
		width: 84,
		textAlign: "right",
		fontVariant: ["tabular-nums"],
	},
}));
