import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Button } from "./button";
import { Card } from "./card";

type EmptyStateProps = {
	title: string;
	body: string;
	actionLabel?: string;
	onAction?: () => void;
	tone?: "default" | "danger";
};

export function EmptyState({
	title,
	body,
	actionLabel,
	onAction,
	tone = "default",
}: EmptyStateProps) {
	return (
		<Card style={styles.card}>
			<AppText
				variant="section"
				color={tone === "danger" ? "danger" : "default"}
			>
				{title}
			</AppText>
			<AppText color="muted">{body}</AppText>
			{actionLabel && onAction ? (
				<Button label={actionLabel} variant="text" onPress={onAction} />
			) : null}
		</Card>
	);
}

const styles = StyleSheet.create((theme) => ({
	card: { gap: theme.spacing.sm },
}));
