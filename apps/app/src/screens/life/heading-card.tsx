import type { GoalStatus } from "@bro/logic";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Icon } from "../../components/icon";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

/** A heading's state, in the one shape the Life screens both use. */
export function HeadingStatusBadge({
	status,
	label,
}: {
	status: GoalStatus;
	label: string;
}) {
	return (
		<View style={[styles.badge, status === "active" && styles.activeBadge]}>
			<AppText
				variant="eyebrow"
				color={status === "active" ? "brand" : "muted"}
			>
				{label}
			</AppText>
		</View>
	);
}

type HeadingCardProps = {
	label: string;
	status: GoalStatus;
	statusLabel: string;
	/** What the heading is aiming at, in words. */
	summary: string;
	/** An optional date the heading is set against. */
	detail?: string | null;
	onPress?: () => void;
};

/**
 * C24 HeadingCard. A heading's state, name and aim, as one card.
 * Only an active heading carries the selection tint; archived and removed
 * headings keep their identity in a quieter badge.
 */
export function HeadingCard({
	label,
	status,
	statusLabel,
	summary,
	detail,
	onPress,
}: HeadingCardProps) {
	const { theme } = useUnistyles();
	const content = (
		<>
			<View style={styles.copy}>
				<HeadingStatusBadge status={status} label={statusLabel} />
				<AppText variant="serifQuote">{label}</AppText>
				<AppText variant="caption" color="muted">
					{summary}
				</AppText>
				{detail ? (
					<AppText variant="caption" color="subtle">
						{detail}
					</AppText>
				) : null}
			</View>
			{onPress ? (
				<Icon name="chevron-right" size={16} color={theme.colors.textSubtle} />
			) : null}
		</>
	);

	if (!onPress) {
		return <View style={styles.card}>{content}</View>;
	}
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={({ pressed }) => [styles.card, pressed && styles.pressed]}
		>
			{content}
		</Pressable>
	);
}

const styles = StyleSheet.create((theme) => ({
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
		padding: theme.spacing.lg,
		borderRadius: theme.radius.card,
		backgroundColor: theme.colors.surface1,
	},
	pressed: { backgroundColor: theme.colors.surface2 },
	copy: { flex: 1, gap: theme.spacing.xs, alignItems: "flex-start" },
	badge: {
		paddingHorizontal: theme.spacing.sm,
		paddingVertical: theme.spacing.xs,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.surface2,
	},
	activeBadge: { backgroundColor: theme.colors.selectedSoft },
}));
