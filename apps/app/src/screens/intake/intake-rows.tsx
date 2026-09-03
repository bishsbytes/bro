import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { Icon } from "../../components/icon";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

export type IntakeRowProps = {
	/** A time column in tabular figures, e.g. "07:40". */
	leading?: string | null;
	title: string;
	meta?: string | null;
	/** Right-aligned tabular figure: what the row added, or its portion. */
	value?: string | null;
	/** A control in place of the value, such as a delete button. */
	action?: ReactNode;
	chevron?: boolean;
	last?: boolean;
	disabled?: boolean;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	onPress?: () => void;
	onLongPress?: () => void;
	testID?: string;
};

/**
 * One hairline row in a panel: time, name, meta, and a right-aligned figure.
 * The design's list item for intake, where a stack of bordered cards would
 * double the visual weight of a day that is only five lines long.
 */
export function IntakeRow({
	leading,
	title,
	meta,
	value,
	action,
	chevron = false,
	last = false,
	disabled = false,
	accessibilityLabel,
	accessibilityHint,
	onPress,
	onLongPress,
	testID,
}: IntakeRowProps) {
	const { theme } = useUnistyles();
	const content = (
		<>
			{leading ? (
				<AppText variant="micro" color="subtle" style={styles.leading}>
					{leading}
				</AppText>
			) : null}
			<View style={styles.copy}>
				<AppText variant="label" numberOfLines={1}>
					{title}
				</AppText>
				{meta ? (
					<AppText variant="caption" color="muted" numberOfLines={1}>
						{meta}
					</AppText>
				) : null}
			</View>
			{value ? (
				<AppText variant="caption" style={styles.value}>
					{value}
				</AppText>
			) : null}
			{action}
			{chevron ? (
				<Icon name="chevron-right" size={20} color={theme.colors.ink3} />
			) : null}
		</>
	);

	if (!onPress && !onLongPress) {
		return (
			<View testID={testID} style={[styles.row, last && styles.lastRow]}>
				{content}
			</View>
		);
	}

	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? title}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			onLongPress={onLongPress}
			style={({ pressed }) => [
				styles.row,
				last && styles.lastRow,
				pressed && styles.pressed,
				disabled && styles.disabled,
			]}
		>
			{content}
		</Pressable>
	);
}

type RowPanelProps = {
	children: ReactNode;
	heading?: string;
	/** A count or a date beside the heading, in the quietest ink. */
	meta?: string | null;
	testID?: string;
};

/** One surface holding hairline rows: the system's list, not a stack of cards. */
export function RowPanel({ children, heading, meta, testID }: RowPanelProps) {
	return (
		<Card testID={testID} style={styles.panel}>
			{heading ? (
				<View style={styles.heading}>
					<AppText variant="label">{heading}</AppText>
					{meta ? (
						<AppText variant="micro" color="subtle">
							{meta}
						</AppText>
					) : null}
				</View>
			) : null}
			<View>{children}</View>
		</Card>
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
	pressed: { backgroundColor: theme.colors.surfaceSunk },
	disabled: { opacity: theme.opacity.disabled },
	leading: {
		width: 40,
		flexShrink: 0,
		fontVariant: ["tabular-nums"],
	},
	copy: { flex: 1, gap: theme.spacing.xs },
	value: {
		flexShrink: 0,
		textAlign: "right",
		fontVariant: ["tabular-nums"],
	},
	panel: {
		gap: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
	},
	heading: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: theme.spacing.md,
		paddingTop: theme.spacing.xs,
	},
}));
