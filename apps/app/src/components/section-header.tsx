import type { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";

type SectionHeaderProps = {
	title: string;
	eyebrow?: string;
	action?: ReactNode;
	tone?: "default" | "danger";
};

export function SectionHeader({
	title,
	eyebrow,
	action,
	tone = "default",
}: SectionHeaderProps) {
	return (
		<View style={styles.container}>
			<View style={styles.copy}>
				{eyebrow ? (
					<AppText variant="caption" color="muted" style={styles.eyebrow}>
						{eyebrow}
					</AppText>
				) : null}
				<AppText
					variant="section"
					color={tone === "danger" ? "danger" : "default"}
					style={styles.title}
				>
					{title}
				</AppText>
			</View>
			{action}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	copy: { flexGrow: 1, flexShrink: 1, flexBasis: 160 },
	eyebrow: {
		marginBottom: theme.spacing.xs,
	},
	title: {},
}));
