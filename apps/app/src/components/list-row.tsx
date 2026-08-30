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
			style={[styles.row, style]}
			{...props}
		>
			<View style={styles.content}>
				<View style={styles.heading}>
					<AppText variant="label" style={styles.title}>
						{title}
					</AppText>
					{value ? (
						<AppText variant="caption" color="muted">
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
				<Icon name="chevron-right" size={24} color={theme.colors.textSubtle} />
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
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	content: { flex: 1, gap: theme.spacing.xs },
	heading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	title: { fontWeight: "600" },
}));
