import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "./app-text";
import { Button } from "./button";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

/** A full-height form, with actions kept above the keyboard and safe area. */
export function FormSheet({
	visible,
	title,
	busy,
	onClose,
	footer,
	children,
}: {
	visible: boolean;
	title: string;
	busy: boolean;
	onClose: () => void;
	footer: ReactNode;
	children: ReactNode;
}) {
	const { t } = useTranslation("common");
	const { theme } = useUnistyles();
	if (!visible) return null;
	return (
		<Modal
			visible
			animationType="none"
			onRequestClose={() => {
				if (!busy) onClose();
			}}
		>
			<SafeAreaView
				accessibilityViewIsModal
				style={{
					flex: 1,
					minHeight: 0,
					backgroundColor: theme.colors.background,
				}}
			>
				<KeyboardAvoidingView
					style={styles.grow}
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
					<View style={styles.header}>
						<Button
							label={t("actions.close")}
							variant="text"
							disabled={busy}
							onPress={onClose}
							style={styles.close}
						/>
						<AppText variant="eyebrow" style={styles.title}>
							{title}
						</AppText>
						<View style={styles.balance} />
					</View>
					<ScrollView
						style={styles.grow}
						contentContainerStyle={styles.content}
						keyboardShouldPersistTaps="handled"
						keyboardDismissMode="on-drag"
					>
						{children}
					</ScrollView>
					<View style={styles.footer}>{footer}</View>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</Modal>
	);
}

const styles = StyleSheet.create((theme) => ({
	grow: { flex: 1 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: theme.spacing.gutter,
		paddingTop: theme.spacing.sm,
		paddingBottom: theme.spacing.sm,
	},
	close: { paddingHorizontal: 0, alignItems: "flex-start", flex: 1 },
	title: { flex: 2, textAlign: "center" },
	balance: { flex: 1 },
	content: {
		paddingHorizontal: theme.spacing.gutter,
		paddingBottom: theme.spacing.lg,
	},
	footer: {
		paddingHorizontal: theme.spacing.gutter,
		paddingTop: theme.spacing.sm,
		paddingBottom: theme.spacing.md,
		gap: theme.spacing.sm,
	},
}));
