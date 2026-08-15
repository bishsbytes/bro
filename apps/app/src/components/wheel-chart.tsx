import { View } from "react-native";
import Svg, { Line, Polygon } from "react-native-svg";
import type { WheelScore } from "../review/review-store";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";

const SIZE = 320;
const CENTRE = SIZE / 2;
const RADIUS = 112;

function point(index: number, count: number, radius: number) {
	const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
	return {
		x: CENTRE + Math.cos(angle) * radius,
		y: CENTRE + Math.sin(angle) * radius,
	};
}

function polygonPoints(values: readonly number[]): string {
	return values
		.map((value, index) => {
			const position = point(
				index,
				values.length,
				RADIUS * (Math.max(0, Math.min(10, value)) / 10),
			);
			return `${position.x},${position.y}`;
		})
		.join(" ");
}

type WheelChartProps = {
	scores: readonly WheelScore[];
	previousScores?: readonly WheelScore[];
};

export function WheelChart({ scores, previousScores = [] }: WheelChartProps) {
	const { theme } = useUnistyles();
	const previousBySlug = new Map(
		previousScores.map((score) => [score.slug, score.value]),
	);
	const comparablePrevious = scores.every((score) =>
		previousBySlug.has(score.slug),
	)
		? scores.map((score) => previousBySlug.get(score.slug) ?? 0)
		: null;

	return (
		<View style={styles.container}>
			<Svg
				accessibilityLabel="Wheel of life chart"
				viewBox={`0 0 ${SIZE} ${SIZE}`}
				height={320}
				width="100%"
			>
				{[0.25, 0.5, 0.75, 1].map((level) => (
					<Polygon
						key={level}
						points={polygonPoints(scores.map(() => level * 10))}
						fill="none"
						stroke={theme.colors.border}
						strokeWidth="1"
					/>
				))}
				{scores.map((score, index) => {
					const outer = point(index, scores.length, RADIUS);
					return (
						<Line
							key={score.slug}
							x1={CENTRE}
							y1={CENTRE}
							x2={outer.x}
							y2={outer.y}
							stroke={theme.colors.border}
							strokeWidth="1"
						/>
					);
				})}
				{comparablePrevious ? (
					<Polygon
						points={polygonPoints(comparablePrevious)}
						fill="none"
						stroke={theme.colors.textMuted}
						strokeWidth="3"
						strokeDasharray="7 5"
					/>
				) : null}
				<Polygon
					points={polygonPoints(scores.map((score) => score.value))}
					fill={theme.colors.selected}
					fillOpacity={0.65}
					stroke={theme.colors.brand}
					strokeWidth="4"
					strokeLinejoin="round"
				/>
			</Svg>
			<View style={styles.legend}>
				<View style={styles.legendItem}>
					<View style={[styles.swatch, styles.current]} />
					<AppText variant="caption">This review</AppText>
				</View>
				{comparablePrevious ? (
					<View style={styles.legendItem}>
						<View style={[styles.swatch, styles.previous]} />
						<AppText variant="caption" color="muted">
							Previous review
						</AppText>
					</View>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: { alignItems: "center" },
	legend: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: theme.spacing.lg,
	},
	legendItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
	},
	swatch: { width: 24, height: 3 },
	current: { backgroundColor: theme.colors.brand },
	previous: { backgroundColor: theme.colors.textMuted },
}));
