import { type Href, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { playSelectionHaptic } from "../feedback/selection-haptic";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon, type IconName } from "./icon";
import { ModalSheet } from "./modal-sheet";

type QuickLogActionProps = {
	icon: IconName;
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
				<Icon name={icon} color={theme.colors.brand} size={24} />
			</View>
			<View style={styles.actionCopy}>
				<AppText variant="label" style={styles.actionTitle}>
					{title}
				</AppText>
				<AppText variant="caption" color="muted">
					{detail}
				</AppText>
			</View>
			<Icon name="chevron-right" color={theme.colors.textSubtle} size={24} />
		</TouchableOpacity>
	);
}

export function QuickLogFab({ bottom }: { bottom: number }) {
	const { t } = useTranslation("navigation");
	const { theme } = useUnistyles();
	const [open, setOpen] = useState(false);

	function choose(href: Href) {
		setOpen(false);
		router.push(href);
	}

	function openSheet() {
		playSelectionHaptic();
		setOpen(true);
	}

	return (
		<>
			<TouchableOpacity
				accessibilityRole="button"
				accessibilityLabel={t("quickLog.open")}
				activeOpacity={0.82}
				style={[styles.fab, { bottom }]}
				onPress={openSheet}
			>
				<Icon name="add" color={theme.colors.onBrand} size={28} />
			</TouchableOpacity>

			<ModalSheet
				visible={open}
				onClose={() => setOpen(false)}
				closeAccessibilityLabel={t("quickLog.close")}
			>
				<AppText variant="section">{t("quickLog.title")}</AppText>
				<View style={styles.actions}>
					<QuickLogAction
						icon="food"
						title={t("quickLog.food")}
						detail={t("quickLog.foodDetail")}
						onPress={() => choose("/food/log")}
					/>
					<QuickLogAction
						icon="drink"
						title={t("quickLog.drink")}
						detail={t("quickLog.drinkDetail")}
						onPress={() => choose("/drinks/log")}
					/>
					<QuickLogAction
						icon="check-in"
						title={t("quickLog.checkIn")}
						detail={t("quickLog.checkInDetail")}
						onPress={() => choose("/check-in")}
					/>
				</View>
			</ModalSheet>
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
