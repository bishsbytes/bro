import { TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Card } from "./card";
import { CardActionCue } from "./card-action-cue";
import { Icon } from "./icon";

type CheckInCardProps = {
	name: string;
	/** The answered summary, or null when this sitting has not been recorded. */
	summary: string | null;
	/** Shown in place of a summary before the sitting is recorded. */
	tagline: string;
	/** One sitting leads with a brand fill; the others stay compact. */
	featured?: boolean;
	/** Complete or partial, once the sitting exists. */
	statusLabel?: string | null;
	/** The dimensions this sitting will ask about. Featured invitations only. */
	dimensionsLabel?: string | null;
	startLabel?: string | null;
	/** Names the dimensions left unanswered. */
	partialLabel?: string | null;
	sourceStamp?: string | null;
	accessibilityLabel: string;
	accessibilityHint?: string;
	onPress: () => void;
};

/**
 * C15 CheckInCard. Presentational: every string arrives translated so the
 * check-in vocabulary stays with the screen that owns it.
 */
export function CheckInCard({
	name,
	summary,
	tagline,
	featured = false,
	statusLabel,
	dimensionsLabel,
	startLabel,
	partialLabel,
	sourceStamp,
	accessibilityLabel,
	accessibilityHint,
	onPress,
}: CheckInCardProps) {
	const { theme } = useUnistyles();

	return (
		<TouchableOpacity
			activeOpacity={theme.opacity.pressed}
			style={styles.wrapper}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			onPress={onPress}
		>
			<Card
				style={[
					styles.card,
					featured && styles.featured,
					!featured && !summary && styles.compact,
				]}
			>
				<View style={styles.copy}>
					<View style={styles.heading}>
						<AppText
							variant="eyebrow"
							color={featured ? "onBrand" : "muted"}
							style={styles.name}
						>
							{name}
						</AppText>
						{statusLabel ? (
							<AppText variant="footnote" color="muted">
								{statusLabel}
							</AppText>
						) : null}
					</View>
					<AppText
						variant={featured ? "title" : "body"}
						color={featured ? "onBrand" : "default"}
					>
						{summary ?? tagline}
					</AppText>
					{featured && dimensionsLabel ? (
						<AppText variant="caption" color="onBrand">
							{dimensionsLabel}
						</AppText>
					) : null}
					{featured && startLabel ? <CardActionCue label={startLabel} /> : null}
					{partialLabel ? (
						<AppText variant="caption" color="muted">
							{partialLabel}
						</AppText>
					) : null}
					{sourceStamp ? (
						<AppText variant="footnote" color="muted">
							{sourceStamp}
						</AppText>
					) : null}
				</View>
				{!featured ? (
					<Icon name="chevron-right" size={20} color={theme.colors.ink2} />
				) : null}
			</Card>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create((theme) => ({
	wrapper: { flexShrink: 0 },
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
	compact: { borderRadius: theme.radius.control },
	featured: { backgroundColor: theme.colors.brand },
	copy: { flex: 1, gap: theme.spacing.sm },
	name: { flex: 1 },
	heading: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
	},
}));
