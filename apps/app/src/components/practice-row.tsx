import { View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Button } from "./button";
import { Card } from "./card";

type PracticeRowProps = {
	label: string;
	progressLabel?: string | null;
	statusLabel: string;
	/** Omitted for practices the app cannot mark done on the user's behalf. */
	actionLabel?: string | null;
	actionVariant?: "text" | "secondary";
	busy?: boolean;
	onAction?: () => void;
};

/** C25 PracticeRow. A named practice, its progress, and its one action. */
export function PracticeRow({
	label,
	progressLabel,
	statusLabel,
	actionLabel,
	actionVariant = "secondary",
	busy = false,
	onAction,
}: PracticeRowProps) {
	return (
		<Card style={styles.row}>
			<View style={styles.copy}>
				<AppText variant="monoList">{label}</AppText>
				{progressLabel ? (
					<AppText color="muted">{progressLabel}</AppText>
				) : null}
				<AppText variant="caption" color="subtle">
					{statusLabel}
				</AppText>
			</View>
			{actionLabel && onAction ? (
				<Button
					label={actionLabel}
					variant={actionVariant}
					loading={busy}
					onPress={onAction}
				/>
			) : null}
		</Card>
	);
}

const styles = StyleSheet.create((theme) => ({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
	copy: { flex: 1, gap: theme.spacing.xs },
}));
