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
	usualRange?: DialRange | null;
	heading?: number | null;
	domain: DataDomain;
	accessibilityLabel: string;
	mini?: boolean;
};

const START = -225;
const SWEEP = 270;

function clamp(value: number, range: DialRange) {
	if (range.max <= range.min) return 0.5;
	return Math.max(
		0,
		Math.min(1, (value - range.min) / (range.max - range.min)),
	);
}

function point(angle: number, radius: number, centre: number) {
	const radians = (angle * Math.PI) / 180;
	return vec(
		centre + Math.cos(radians) * radius,
		centre + Math.sin(radians) * radius,
	);
}

function arcPath(box: number, radius: number, start: number, sweep: number) {
	const path = Skia.Path.Make();
	const inset = box / 2 - radius;
	path.addArc(
		Skia.XYWHRect(inset, inset, radius * 2, radius * 2),
		start,
		sweep,
	);
	return path;
}

/** Helm's open instrument dial. Domain colour describes the measurement only. */
export function Dial({
	label,
	value,
	unit,
	current,
	range,
	usualRange,
	heading,
	domain,
	accessibilityLabel,
	mini = false,
}: DialProps) {
	const { theme } = useUnistyles();
	const box = mini ? 132 : theme.dial.box;
	const centre = box / 2;
	const radius = mini ? 50 : theme.dial.radius;
	const track = useMemo(
		() => arcPath(box, radius, START, SWEEP),
		[box, radius],
	);
	const bandStart = usualRange ? clamp(usualRange.min, range) : 0;
	const bandEnd = usualRange ? clamp(usualRange.max, range) : 0;
	const band = useMemo(
		() =>
			arcPath(
				box,
				radius,
				START + bandStart * SWEEP,
				(bandEnd - bandStart) * SWEEP,
			),
		[bandEnd, bandStart, box, radius],
	);
	const markerAngle = START + clamp(current, range) * SWEEP;
	const marker = point(markerAngle, radius, centre);
	const headingAngle =
		heading === null || heading === undefined
			? null
			: START + clamp(heading, range) * SWEEP;
	const color = theme.colors[domain];
	const trackWidth = mini ? theme.dial.trackMini : theme.dial.track;
	const ticks = Array.from(
		{ length: SWEEP / theme.dial.tickEvery + 1 },
		(_, index) => START + index * theme.dial.tickEvery,
	);

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
							p1={point(angle, radius - 9, centre)}
							p2={point(angle, radius - 13, centre)}
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
							opacity={0.9}
							style="stroke"
							strokeCap="round"
							strokeWidth={theme.dial.bandEdge}
						>
							<BlurMask blur={5} style="solid" />
						</Path>
					</>
				) : null}
				<Circle
					cx={marker.x}
					cy={marker.y}
					r={mini ? 8 : 10}
					color={color}
					opacity={0.7}
				>
					<BlurMask blur={8} style="solid" />
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
						p1={point(headingAngle, radius + 8, centre)}
						p2={point(headingAngle, radius + 15, centre)}
						color={theme.colors.ink}
						strokeWidth={2}
					/>
				)}
			</Canvas>
			<View pointerEvents="none" style={styles.readout}>
				<AppText variant={mini ? "monoList" : "monoDial"}>{value}</AppText>
				{unit ? (
					<AppText variant="monoInline" color="subtle">
						{unit}
					</AppText>
				) : null}
				<AppText variant="caption" color="muted" style={styles.label}>
					{label}
				</AppText>
			</View>
			{mini ? null : (
				<>
					<AppText variant="micro" color="subtle" style={styles.minimum}>
						{range.min}
					</AppText>
					<AppText variant="micro" color="subtle" style={styles.maximum}>
						{range.max}
					</AppText>
				</>
			)}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	root: { alignSelf: "center", alignItems: "center", justifyContent: "center" },
	readout: { alignItems: "center", maxWidth: 140 },
	label: { marginTop: theme.spacing.xs, textAlign: "center" },
	minimum: { position: "absolute", left: 4, bottom: 12 },
	maximum: { position: "absolute", right: 4, bottom: 12 },
}));
