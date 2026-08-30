import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];

type QuickLogActionProps = {
	icon: MaterialIconName;
	title: string;
	detail: string;
	onPress: () => void;
};

function QuickLogAction({ icon, title, detail, onPress }: QuickLogActionProps) {
	const { theme } = useUnistyles();

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={title}
			activeOpacity={0.72}
			style={styles.actionRow}
			onPress={onPress}
		>
			<View style={styles.actionIcon}>
				<MaterialIcons name={icon} color={theme.colors.brand} size={24} />
			</View>
			<View style={styles.actionCopy}>
				<AppText variant="label" style={styles.actionTitle}>
					{title}
				</AppText>
				<AppText variant="caption" color="muted">
					{detail}
				</AppText>
			</View>
			<MaterialIcons
				name="chevron-right"
				color={theme.colors.textSubtle}
				size={24}
			/>
		</TouchableOpacity>
	);
}

export function QuickLogFab({ bottom }: { bottom: number }) {
	const { t } = useTranslation("navigation");
	const { theme } = useUnistyles();
	const insets = useSafeAreaInsets();
	const [open, setOpen] = useState(false);

	function choose(href: Href) {
		setOpen(false);
		router.push(href);
	}

	return (
		<>
			<TouchableOpacity
				accessibilityRole="button"
				accessibilityLabel={t("quickLog.open")}
				activeOpacity={0.82}
				style={[styles.fab, { bottom }]}
				onPress={() => setOpen(true)}
			>
				<MaterialIcons name="add" color={theme.colors.onBrand} size={28} />
			</TouchableOpacity>

			<Modal
				animationType="slide"
				transparent
				visible={open}
				onRequestClose={() => setOpen(false)}
			>
				<View style={styles.overlay}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("quickLog.close")}
						style={styles.backdrop}
						onPress={() => setOpen(false)}
					/>
					<View
						accessibilityViewIsModal
						style={[
							styles.sheet,
							{ paddingBottom: insets.bottom + theme.spacing.lg },
						]}
					>
						<View style={styles.handle} />
						<AppText variant="section">{t("quickLog.title")}</AppText>
						<View style={styles.actions}>
							<QuickLogAction
								icon="restaurant"
								title={t("quickLog.food")}
								detail={t("quickLog.foodDetail")}
								onPress={() => choose("/food/search")}
							/>
							<QuickLogAction
								icon="local-drink"
								title={t("quickLog.drink")}
								detail={t("quickLog.drinkDetail")}
								onPress={() => choose("/drinks/log")}
							/>
							<QuickLogAction
								icon="sentiment-satisfied"
								title={t("quickLog.checkIn")}
								detail={t("quickLog.checkInDetail")}
								onPress={() => choose("/check-in")}
							/>
						</View>
					</View>
				</View>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	fab: {
		position: "absolute",
		right: theme.spacing.lg,
		zIndex: 10,
		width: 56,
		height: 56,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.brand,
		elevation: 8,
	},
	overlay: { flex: 1, justifyContent: "flex-end" },
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: theme.colors.scrim,
	},
	sheet: {
		gap: theme.spacing.lg,
		paddingTop: theme.spacing.sm,
		paddingHorizontal: theme.spacing.lg,
		borderTopLeftRadius: theme.radius.lg,
		borderTopRightRadius: theme.radius.lg,
		backgroundColor: theme.colors.background,
	},
	handle: {
		alignSelf: "center",
		width: 40,
		height: 4,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.border,
	},
	actions: { gap: theme.spacing.sm },
	actionRow: {
		minHeight: 76,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
		padding: theme.spacing.md,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	actionIcon: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.selected,
	},
	actionCopy: { flex: 1, gap: theme.spacing.xs },
	actionTitle: { fontWeight: "700" },
}));
