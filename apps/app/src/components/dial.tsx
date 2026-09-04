import {
	BlurMask,
	Canvas,
	Circle,
	Group,
	Line,
	Path,
	Skia,
	vec,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { View } from "react-native";
import { type DataDomain, StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";

type DialRange = { min: number; max: number };

type DialProps = {
	label: string;
	value: string;
	unit?: string;
	current: number;
	range: DialRange;
	rangeLabels?: { min: string; max: string };
	usualRange?: DialRange | null;
	heading?: number | null;
	domain: DataDomain;
	accessibilityLabel: string;
	mini?: boolean;
};

function clamp(value: number, range: DialRange) {
	if (range.max <= range.min) return 0.5;
	return Math.max(
		0,
		Math.min(1, (value - range.min) / (range.max - range.min)),
	);
}

function point(
	angle: number,
	radius: number,
	centreX: number,
	centreY: number,
) {
	const radians = (angle * Math.PI) / 180;
	return vec(
		centreX + Math.cos(radians) * radius,
		centreY + Math.sin(radians) * radius,
	);
}

function arcPath(
	box: number,
	radius: number,
	centreY: number,
	start: number,
	sweep: number,
) {
	const insetX = box / 2 - radius;
	const insetY = centreY - radius;
	return Skia.PathBuilder.Make()
		.addArc(Skia.XYWHRect(insetX, insetY, radius * 2, radius * 2), start, sweep)
		.build();
}

/** Helm's open instrument dial. Domain colour describes the measurement only. */
export function Dial({
	label,
	value,
	unit,
	current,
	range,
	rangeLabels,
	usualRange,
	heading,
	domain,
	accessibilityLabel,
	mini = false,
}: DialProps) {
	const { theme } = useUnistyles();
	const box = mini ? 132 : theme.dial.box;
	const centreX = box / 2;
	// The reference leaves a little more room above the scale labels than above
	// the arc. Preserve that optical centring instead of centring the SVG bounds.
	const centreY = mini ? box / 2 : box / 2 + 4;
	const radius = mini ? 50 : theme.dial.radius;
	// Skia starts angles on the positive x-axis. Helm's authored angles start at
	// 12 o'clock, so rotate them by a quarter turn before drawing.
	const start = theme.dial.arcStart - 90;
	const sweep = theme.dial.sweep;
	const track = useMemo(
		() => arcPath(box, radius, centreY, start, sweep),
		[box, centreY, radius, start, sweep],
	);
	const bandStart = usualRange ? clamp(usualRange.min, range) : 0;
	const bandEnd = usualRange ? clamp(usualRange.max, range) : 0;
	const band = useMemo(
		() =>
			arcPath(
				box,
				radius,
				centreY,
				start + bandStart * sweep,
				(bandEnd - bandStart) * sweep,
			),
		[bandEnd, bandStart, box, centreY, radius, start, sweep],
	);
	const markerAngle = start + clamp(current, range) * sweep;
	const marker = point(markerAngle, radius, centreX, centreY);
	const headingAngle =
		heading === null || heading === undefined
			? null
			: start + clamp(heading, range) * sweep;
	const color = theme.colors[domain];
	const trackWidth = mini ? theme.dial.trackMini : theme.dial.track;
	const ticks = Array.from(
		{ length: sweep / theme.dial.tickEvery + 1 },
		(_, index) => start + index * theme.dial.tickEvery,
	);
	const minimum = point(start, radius + 2, centreX, centreY);
	const maximum = point(start + sweep, radius + 2, centreX, centreY);

	return (
		<View
			accessible
			accessibilityLabel={accessibilityLabel}
			style={[styles.root, { width: box, height: box }]}
		>
			<Canvas style={StyleSheet.absoluteFillObject}>
				<Path
					path={track}
					color={theme.colors.hairlineStrong}
					style="stroke"
					strokeCap="round"
					strokeWidth={trackWidth}
				/>
				<Group opacity={0.6}>
					{ticks.map((angle) => (
						<Line
							key={angle}
							p1={point(angle, radius - 9, centreX, centreY)}
							p2={point(angle, radius - 13, centreX, centreY)}
							color={theme.colors.ink3}
							strokeWidth={1}
						/>
					))}
				</Group>
				{usualRange ? (
					<>
						<Path
							path={band}
							color={theme.tint(color, theme.dial.bandFill)}
							style="stroke"
							strokeCap="round"
							strokeWidth={trackWidth}
						/>
						<Path
							path={band}
							color={color}
							opacity={0.55}
							style="stroke"
							strokeCap="round"
							strokeWidth={theme.dial.bandEdge}
						>
							<BlurMask blur={theme.dial.bandGlow} style="solid" />
						</Path>
						<Path
							path={band}
							color={color}
							opacity={0.9}
							style="stroke"
							strokeCap="round"
							strokeWidth={theme.dial.bandEdge}
						/>
					</>
				) : null}
				<Circle
					cx={marker.x}
					cy={marker.y}
					r={mini ? 8 : 10}
					color={color}
					opacity={0.7}
				>
					<BlurMask blur={theme.dial.markerGlow} style="solid" />
				</Circle>
				<Circle
					cx={marker.x}
					cy={marker.y}
					r={mini ? theme.dial.markerMini : theme.dial.marker}
					color={color}
				/>
				<Circle
					cx={marker.x}
					cy={marker.y}
					r={mini ? 2 : 3}
					color={theme.colors.base}
				/>
				{headingAngle === null ? null : (
					<Line
						p1={point(headingAngle, radius + 8, centreX, centreY)}
						p2={point(headingAngle, radius + 15, centreX, centreY)}
						color={theme.colors.ink}
						strokeWidth={2}
					/>
				)}
			</Canvas>
			<View pointerEvents="none" style={styles.readout}>
				<View style={styles.valueLine}>
					<AppText
						testID="dial-value"
						variant={mini ? "monoList" : "monoDial"}
						numberOfLines={1}
					>
						{value}
					</AppText>
					{unit ? (
						<AppText
							testID="dial-unit"
							variant="label"
							color="subtle"
							style={mini ? styles.unitMini : styles.unit}
						>
							{unit}
						</AppText>
					) : null}
				</View>
				<AppText variant="caption" color="muted" style={styles.label}>
					{label}
				</AppText>
			</View>
			{mini ? null : (
				<>
					<AppText
						testID="dial-minimum"
						color="subtle"
						style={[styles.scale, { left: minimum.x - 40, top: minimum.y + 8 }]}
					>
						{rangeLabels?.min ?? range.min}
					</AppText>
					<AppText
						testID="dial-maximum"
						color="subtle"
						style={[styles.scale, { left: maximum.x - 40, top: maximum.y + 8 }]}
					>
						{rangeLabels?.max ?? range.max}
					</AppText>
				</>
			)}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	root: { alignSelf: "center", alignItems: "center", justifyContent: "center" },
	readout: { alignItems: "center", width: "100%" },
	valueLine: { flexDirection: "row", alignItems: "baseline", gap: 4 },
	unit: { fontSize: 16, lineHeight: 20 },
	unitMini: { fontSize: 11, lineHeight: 14, marginLeft: -2 },
	label: { marginTop: theme.spacing.xs, textAlign: "center" },
	scale: {
		position: "absolute",
		width: 80,
		fontFamily: theme.fonts.mono,
		fontSize: 10,
		lineHeight: 12,
		textAlign: "center",
	},
}));
