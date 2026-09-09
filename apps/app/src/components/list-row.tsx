import type { ComponentProps, ReactNode } from "react";
import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon } from "./icon";

type ListRowProps = Omit<ComponentProps<typeof Pressable>, "children"> & {
	title: string;
	detail?: string;
	value?: string;
	children?: ReactNode;
	showChevron?: boolean;
	layout?: "stacked" | "inline";
	variant?: "filled" | "plain" | "outlined";
	density?: "regular" | "compact";
	separator?: boolean;
};

export function ListRow({
	title,
	detail,
	value,
	children,
	showChevron = true,
	layout = "stacked",
	variant = "filled",
	density = "regular",
	separator = false,
	style,
	...props
}: ListRowProps) {
	const { theme } = useUnistyles();

	return (
		<Pressable
			accessibilityRole="button"
			{...props}
			aria-disabled={!!props.disabled}
			accessibilityState={{
				...props.accessibilityState,
				disabled: !!props.disabled,
			}}
			style={(state) => [
				styles.row,
				styles[variant],
				showChevron && styles.chevronRow,
				density === "compact" && styles.compactRow,
				variant === "plain" && styles.plainInset,
				separator && styles.separator,
				typeof style === "function" ? style(state) : style,
				state.pressed && !props.disabled && styles.pressed,
				props.disabled && styles.disabled,
			]}
		>
			<View style={styles.content}>
				<View
					style={[styles.heading, layout === "inline" && styles.inlineHeading]}
				>
					<AppText
						variant={density === "compact" ? "caption" : "label"}
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
						<AppText
							variant="footnote"
							color="muted"
							style={styles.inlineDetail}
						>
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
		</Pressable>
	);
}

const styles = StyleSheet.create((theme) => ({
	compactRow: {
		paddingVertical: theme.spacing.sm,
		gap: theme.spacing.sm,
	},
	inlineHeading: { gap: theme.spacing.sm, flexWrap: "wrap" },
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
		borderBottomWidth: 0,
	},
	filled: {
		backgroundColor: theme.colors.surface1,
	},
	plain: { backgroundColor: "transparent", borderRadius: 0 },
	plainInset: { paddingHorizontal: 0 },
	outlined: {
		backgroundColor: theme.colors.canvas,
		borderWidth: 1,
		borderBottomWidth: 1,
		borderColor: theme.colors.interactiveBorder,
	},
	separator: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
	pressed: { backgroundColor: theme.colors.rowPressed },
	disabled: { opacity: theme.opacity.disabled },
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
