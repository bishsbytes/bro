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
};

export function ListRow({
	title,
	detail,
	value,
	children,
	showChevron = true,
	style,
	...props
}: ListRowProps) {
	const { theme } = useUnistyles();

	return (
		<TouchableOpacity
			accessibilityRole="button"
			activeOpacity={0.72}
			style={[styles.row, showChevron && styles.chevronRow, style]}
			{...props}
		>
			<View style={styles.content}>
				<View style={styles.heading}>
					<AppText variant="label" style={styles.title}>
						{title}
					</AppText>
					{value ? (
						<AppText variant="monoInline" color="muted">
							{value}
						</AppText>
					) : null}
				</View>
				{detail ? (
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
	row: {
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
	title: {},
}));
