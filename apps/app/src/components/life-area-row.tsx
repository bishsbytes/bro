import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon } from "./icon";

type LifeAreaRowProps = {
	label: string;
	/** The score on its own scale; the bar reads it against `max`. */
	value: number;
	max?: number;
	/** The score in words, e.g. "6 of 10", so the bar is never the only reading. */
	valueLabel: string;
	/** A comparison with the previous review, where there is one. */
	detail?: string | null;
	detailTone?: "muted" | "subtle" | "mind";
	/** A quieter second line, e.g. the label this area carried last time. */
	note?: string | null;
	focusLabel?: string | null;
	accessibilityLabel?: string;
	onPress?: () => void;
};

/**
 * C23 LifeAreaRow. One area's score as a named value with a proportional bar.
 * The wheel's text alternative, and the row the review detail is built from.
 */
export function LifeAreaRow({
	label,
	value,
	max = 10,
	valueLabel,
	detail,
	detailTone = "muted",
	note,
	focusLabel,
	accessibilityLabel,
	onPress,
}: LifeAreaRowProps) {
	const { theme } = useUnistyles();
	const filled = Math.max(0, Math.min(1, value / max));
	const content = (
		<>
			<View style={styles.copy}>
				<View style={styles.heading}>
					<AppText variant="label" style={styles.label}>
						{label}
					</AppText>
					{focusLabel ? (
						<AppText variant="caption" color="brand">
							{focusLabel}
						</AppText>
					) : null}
				</View>
				{detail ? (
					<AppText variant="caption" color={detailTone}>
						{detail}
					</AppText>
				) : null}
				{note ? (
					<AppText variant="footnote" color="subtle">
						{note}
					</AppText>
				) : null}
			</View>
			<View style={styles.track}>
				<View style={[styles.fill, { width: `${filled * 100}%` }]} />
			</View>
			<AppText variant="monoInline" style={styles.value}>
				{valueLabel}
			</AppText>
			{onPress ? (
				<Icon name="chevron-right" size={16} color={theme.colors.textSubtle} />
			) : null}
		</>
	);

	if (!onPress) {
		return (
			<View
				accessible
				accessibilityLabel={accessibilityLabel ?? `${label}, ${valueLabel}`}
				style={styles.row}
			>
				{content}
			</View>
		);
	}
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? `${label}, ${valueLabel}`}
			onPress={onPress}
			style={({ pressed }) => [styles.row, pressed && styles.pressed]}
		>
			{content}
		</Pressable>
	);
}

const styles = StyleSheet.create((theme) => ({
	row: {
		minHeight: theme.control.minHitArea,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
		borderRadius: theme.radius.control,
	},
	pressed: { backgroundColor: theme.colors.rowPressed },
	copy: { flexShrink: 1, flexGrow: 1, flexBasis: 96, gap: theme.spacing.xs },
	heading: {
		flexDirection: "row",
		alignItems: "baseline",
		flexWrap: "wrap",
		gap: theme.spacing.xs,
	},
	label: { flexShrink: 1 },
	track: {
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 72,
		height: 6,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.surface2,
		overflow: "hidden",
	},
	fill: {
		height: "100%",
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.brand,
	},
	value: { flexShrink: 0 },
}));
