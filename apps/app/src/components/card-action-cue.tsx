import { View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon } from "./icon";

/** Decorative label inside a tappable card; the card owns the action. */
export function CardActionCue({ label }: { label: string }) {
	const { theme } = useUnistyles();
	return (
		<View style={styles.cue}>
			<AppText variant="label" style={styles.label}>
				{label}
			</AppText>
			<Icon name="chevron-right" size={20} color={theme.colors.onCardAction} />
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	cue: {
		alignSelf: "flex-start",
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.xl,
		minHeight: theme.control.minHitArea,
		maxWidth: "100%",
		paddingHorizontal: theme.spacing.lg,
		paddingVertical: theme.spacing.sm,
		marginTop: theme.spacing.xs,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.cardAction,
	},
	label: { flexShrink: 1, color: theme.colors.onCardAction },
}));
