import type { ComponentProps, ReactNode } from "react";
import { TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon } from "./icon";

type ListRowProps = Omit<
	ComponentProps<typeof TouchableOpacity>,
	"children"
> & {
	title: string;
	detail?: string;
	value?: string;
	children?: ReactNode;
	showChevron?: boolean;
	layout?: "stacked" | "inline";
};

export function ListRow({
	title,
	detail,
	value,
	children,
	showChevron = true,
	layout = "stacked",
	style,
	...props
}: ListRowProps) {
	const { theme } = useUnistyles();

	return (
		<TouchableOpacity
			accessibilityRole="button"
			activeOpacity={0.72}
			style={[
				styles.row,
				showChevron && styles.chevronRow,
				layout === "inline" && styles.inlineRow,
				style,
			]}
			{...props}
		>
			<View style={styles.content}>
				<View
					style={[styles.heading, layout === "inline" && styles.inlineHeading]}
				>
					<AppText
						variant={layout === "inline" ? "caption" : "label"}
						style={[styles.title, layout === "inline" && styles.inlineTitle]}
					>
						{title}
					</AppText>
					{value ? (
						<AppText
							variant="monoInline"
							color={layout === "inline" ? "default" : "muted"}
							style={[styles.value, layout === "inline" && styles.inlineValue]}
						>
							{value}
						</AppText>
					) : null}
					{detail && layout === "inline" ? (
						<AppText variant="micro" color="muted" style={styles.inlineDetail}>
							{detail}
						</AppText>
					) : null}
				</View>
				{detail && layout !== "inline" ? (
					<AppText variant="caption" color="muted">
						{detail}
					</AppText>
				) : null}
				{children}
			</View>
			{showChevron ? (
				<Icon name="chevron-right" size={16} color={theme.colors.textSubtle} />
			) : null}
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create((theme) => ({
	inlineRow: {
		paddingVertical: 8,
		paddingHorizontal: 0,
		gap: 8,
		backgroundColor: "transparent",
	},
	inlineHeading: { gap: 8, flexWrap: "wrap" },
	inlineTitle: { flex: 1, minWidth: 60 },
	inlineValue: { textAlign: "left", flex: 1, minWidth: 68, maxWidth: "60%" },
	inlineDetail: { flexShrink: 1, textAlign: "right", maxWidth: "38%" },
	row: {
		minHeight: theme.control.minHitArea,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
		padding: theme.spacing.lg,
		borderRadius: theme.radius.control,
		backgroundColor: theme.colors.surface1,
	},
	/**
	 * The chevron's ink spans 8–16 of its 24px box, so it carries 8px of its own
	 * whitespace. Full padding on that edge would read wider than the left.
	 */
	chevronRow: { paddingRight: theme.spacing.sm },
	content: { flex: 1, gap: theme.spacing.xs },
	heading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	title: { flex: 1 },
	value: { flexShrink: 1, maxWidth: "55%", textAlign: "right" },
}));
