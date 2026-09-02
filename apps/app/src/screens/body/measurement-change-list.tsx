import { Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import type { GaugeRange } from "../../components/baseline-gauge";
import type { DataDomain } from "../../components/trend-chart";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

export type MeasurementChange = {
	slug: string;
	label: string;
	/** When the reading it is compared against was taken, e.g. "since 3 Aug". */
	since: string | null;
	/** The change itself, signed and in the user's units, or a stand-in for none. */
	change: string;
	rail: GaugeRange | null;
	band: GaugeRange | null;
	current: number | null;
	previous: number | null;
	domain: DataDomain;
	accessibilityLabel: string;
};

type MeasurementChangeListProps = {
	changes: readonly MeasurementChange[];
	onOpen: (slug: string) => void;
};

const MARK_SIZE = 9;

/**
 * Whether a row has earned its marks. The rail is scaled from the metric's own
 * readings, so before there is a usual range to place them against, two
 * readings always land on the same two spots whatever the change was — a
 * full-width traverse for a millimetre. Until then the row states the change in
 * figures and leaves the track bare.
 */
export function hasPlottableRange(change: MeasurementChange): boolean {
	return change.rail !== null && change.band !== null;
}

function position(value: number, rail: GaugeRange): number {
	if (rail.max <= rail.min) return 50;
	const fraction = (value - rail.min) / (rail.max - rail.min);
	return Math.min(100, Math.max(0, fraction * 100));
}

/**
 * One direct-link row per measurement: a compact baseline gauge from the
 * previous reading to this one, and how far it moved.
 *
 * The change is typeset in ink with a sign and nothing else. For one man a
 * falling waist is the point and for another it is gaining mass, so a direction
 * is not a result: no red, no green, no arrows.
 */
export function MeasurementChangeList({
	changes,
	onOpen,
}: MeasurementChangeListProps) {
	const { theme } = useUnistyles();

	return (
		<View>
			{changes.map((change, index) => (
				<Pressable
					key={change.slug}
					accessibilityRole="button"
					accessibilityLabel={change.accessibilityLabel}
					onPress={() => onOpen(change.slug)}
					style={({ pressed }) => [
						styles.row,
						index === changes.length - 1 && styles.lastRow,
						pressed && styles.rowPressed,
					]}
				>
					<View style={styles.name}>
						<AppText variant="label" numberOfLines={1}>
							{change.label}
						</AppText>
						{change.since ? (
							<AppText variant="micro" color="subtle" numberOfLines={2}>
								{change.since}
							</AppText>
						) : null}
					</View>
					{/* The column is inset by half a mark so a reading sitting on an end
					    stop still draws inside the row rather than over its neighbour. */}
					<View style={styles.gaugeColumn}>
						<View style={styles.gauge}>
							<View style={styles.track} />
							{change.rail && change.band ? (
								<>
									<View
										testID={`change-band-${change.slug}`}
										style={[
											styles.band,
											{
												backgroundColor: theme.colors[change.domain],
												left: `${position(change.band.min, change.rail)}%`,
												width: `${Math.max(
													position(change.band.max, change.rail) -
														position(change.band.min, change.rail),
													0,
												)}%`,
											},
										]}
									/>
									{change.previous !== null ? (
										<View
											testID={`change-previous-${change.slug}`}
											style={[
												styles.previous,
												{
													borderColor: theme.colors[change.domain],
													left: `${position(change.previous, change.rail)}%`,
												},
											]}
										/>
									) : null}
									{change.current !== null ? (
										<View
											testID={`change-current-${change.slug}`}
											style={[
												styles.current,
												{
													backgroundColor: theme.colors[change.domain],
													left: `${position(change.current, change.rail)}%`,
												},
											]}
										/>
									) : null}
								</>
							) : null}
						</View>
					</View>
					<AppText variant="caption" style={styles.change}>
						{change.change}
					</AppText>
				</Pressable>
			))}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
		minHeight: theme.control.buttonMinHeight,
		paddingVertical: theme.spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.line,
	},
	lastRow: { borderBottomWidth: 0 },
	rowPressed: { backgroundColor: theme.colors.surfaceSunk },
	// Text columns are shares rather than fixed widths so a long name, a
	// compound delta ("+1 st 2 lb") and a scaled-up font all still read.
	name: { flex: 1.4 },
	gaugeColumn: { flex: 1, paddingHorizontal: MARK_SIZE / 2 },
	gauge: { height: MARK_SIZE, justifyContent: "center" },
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
		minWidth: 72,
		flexShrink: 0,
		textAlign: "right",
		fontVariant: ["tabular-nums"],
	},
}));
