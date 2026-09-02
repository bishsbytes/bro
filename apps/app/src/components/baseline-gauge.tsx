import { View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import type { DataDomain } from "./trend-chart";

export type GaugeRange = { min: number; max: number };

type BaselineGaugeProps = {
	label: string;
	/** When and how the reading was taken, e.g. "Taped 2 Sep". */
	meta?: string | null;
	/** The formatted numeric portion of the reading. */
	value: string;
	/** Unit copy kept out of metric type, e.g. "cm" or "st 4 lb". */
	unit?: string | null;
	/** The 56px size is one per screen, so the caller decides who gets it. */
	valueVariant?: "metric" | "score";
	rail: GaugeRange;
	railLabels: { min: string; max: string };
	/** The user's own usual range. Absent until there are enough readings. */
	band?: GaugeRange | null;
	current: number;
	previous?: number | null;
	/** One line of plain language stating what the marks say. */
	read?: string | null;
	accessibilityLabel: string;
	domain?: DataDomain;
};

const TICK_COUNT = 11;
const PREVIOUS_DASHES = 3;

function position(value: number, rail: GaugeRange): number {
	if (rail.max <= rail.min) return 50;
	const fraction = (value - rail.min) / (rail.max - rail.min);
	return Math.min(100, Math.max(0, fraction * 100));
}

/**
 * The system's signature reading: a value over a rail carrying the range that is
 * usual for this user, the reading before it, and where this one landed.
 *
 * Solid is this measurement and hollow or dashed is the previous one, which is
 * the wheel's legend, so a user who has read one already can read this. There is
 * no target, no zone, and no colour that means good.
 */
export function BaselineGauge({
	label,
	meta,
	value,
	unit,
	valueVariant = "score",
	rail,
	railLabels,
	band,
	current,
	previous,
	read,
	accessibilityLabel,
	domain = "body",
}: BaselineGaugeProps) {
	const { theme } = useUnistyles();
	const dataColor = theme.colors[domain];
	const bandStart = band ? position(band.min, rail) : 0;
	const bandEnd = band ? position(band.max, rail) : 0;

	return (
		<View
			accessible
			accessibilityLabel={accessibilityLabel}
			style={styles.root}
		>
			<View style={styles.heading}>
				<AppText variant="caption" color="muted" style={styles.label}>
					{label}
				</AppText>
				{meta ? (
					<AppText variant="micro" color="subtle">
						{meta}
					</AppText>
				) : null}
			</View>
			<AppText variant={valueVariant}>
				{value}
				{unit ? (
					<AppText testID="gauge-unit" variant="caption" color="subtle">
						{` ${unit}`}
					</AppText>
				) : null}
			</AppText>
			<View style={styles.rail}>
				{Array.from({ length: TICK_COUNT }, (_unused, index) => (
					<View
						key={`tick-${(index / (TICK_COUNT - 1)) * 100}`}
						style={[
							styles.tick,
							{ left: `${(index / (TICK_COUNT - 1)) * 100}%` },
						]}
					/>
				))}
				{band ? (
					<View
						testID="gauge-band"
						style={[
							styles.band,
							{
								left: `${bandStart}%`,
								width: `${Math.max(bandEnd - bandStart, 0)}%`,
								backgroundColor: dataColor,
								borderColor: dataColor,
							},
						]}
					/>
				) : null}
				{previous === null || previous === undefined ? null : (
					<View
						testID="gauge-previous"
						style={[styles.previous, { left: `${position(previous, rail)}%` }]}
					>
						{Array.from({ length: PREVIOUS_DASHES }, (_unused, index) => (
							<View
								key={`dash-${index * 2}`}
								style={[styles.previousDash, { backgroundColor: dataColor }]}
							/>
						))}
					</View>
				)}
				<View
					testID="gauge-marker"
					style={[styles.marker, { left: `${position(current, rail)}%` }]}
				>
					<View style={[styles.markerCap, { backgroundColor: dataColor }]} />
					<View style={[styles.markerStem, { backgroundColor: dataColor }]} />
				</View>
			</View>
			<View style={styles.scale}>
				<AppText variant="micro" color="subtle">
					{railLabels.min}
				</AppText>
				<AppText variant="micro" color="subtle">
					{railLabels.max}
				</AppText>
			</View>
			{read ? (
				<AppText variant="caption" color="muted">
					{read}
				</AppText>
			) : null}
		</View>
	);
}

const RAIL_HEIGHT = 16;

const styles = StyleSheet.create((theme) => ({
	root: { gap: theme.spacing.sm },
	heading: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: theme.spacing.sm,
	},
	label: { flexShrink: 1 },
	rail: {
		height: RAIL_HEIGHT,
		marginTop: theme.spacing.xs,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.lineStrong,
	},
	tick: {
		position: "absolute",
		bottom: 0,
		width: 1,
		height: 6,
		backgroundColor: theme.colors.lineStrong,
	},
	band: {
		position: "absolute",
		bottom: 0,
		height: RAIL_HEIGHT,
		opacity: theme.opacity.domainTint,
		borderLeftWidth: 1,
		borderRightWidth: 1,
	},
	/**
	 * Three stacked segments rather than a dashed border: a one-pixel dashed edge
	 * renders inconsistently across the platforms, and the previous reading has to
	 * read as dashed everywhere for the legend to hold.
	 */
	previous: {
		position: "absolute",
		bottom: 0,
		width: 1,
		height: RAIL_HEIGHT,
		justifyContent: "space-between",
		opacity: 0.65,
	},
	previousDash: { width: 1, height: 4 },
	marker: {
		position: "absolute",
		bottom: 0,
		width: 2,
		height: RAIL_HEIGHT,
		marginLeft: -1,
		alignItems: "center",
	},
	markerCap: {
		position: "absolute",
		top: -5,
		width: 8,
		height: 8,
		transform: [{ rotate: "45deg" }],
	},
	markerStem: { width: 2, height: RAIL_HEIGHT },
	scale: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
}));
