import { type Href, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { useBodyLogSurface } from "../body/body-log-surface-context";
import { playSelectionHaptic } from "../feedback/selection-haptic";
import { isNicotineTracked } from "../substances/nicotine";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon, type IconName } from "./icon";
import { LoadingIndicator } from "./loading-indicator";
import { ModalSheet } from "./modal-sheet";

type QuickLogPage = "options" | "body";

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

export function QuickLogFab({
	bottom,
	bodyActive = false,
	isNicotineEnabled = isNicotineTracked,
}: {
	bottom: number;
	bodyActive?: boolean;
	isNicotineEnabled?: () => Promise<boolean>;
}) {
	const { t } = useTranslation("navigation");
	const { theme } = useUnistyles();
	const [open, setOpen] = useState(false);
	const [page, setPage] = useState<QuickLogPage>("options");
	const [nicotineEnabled, setNicotineEnabled] = useState(false);
	const { surface: bodyLogSurface } = useBodyLogSurface();

	// Leaving the body page unmounts the surface's content, which is what
	// discards its half-typed draft; there is nothing here to reset.
	function closeSheet() {
		setOpen(false);
		setPage("options");
	}

	function backToQuickLog() {
		setPage("options");
	}

	function choose(href: Href) {
		setOpen(false);
		router.push(href);
	}

	function chooseBody() {
		setPage("body");
		if (!bodyActive) router.push("/body");
	}

	/**
	 * Smoking is the one action this sheet asks about before offering. Eating
	 * and drinking are universal; a standing smoking button for everyone would
	 * be the product assuming something about the person holding the phone.
	 */
	function openSheet() {
		playSelectionHaptic();
		setOpen(true);
		isNicotineEnabled()
			.then(setNicotineEnabled)
			.catch(() => setNicotineEnabled(false));
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
				onClose={closeSheet}
				closeAccessibilityLabel={
					page === "body"
						? (bodyLogSurface?.closeAccessibilityLabel ?? t("quickLog.close"))
						: t("quickLog.close")
				}
			>
				{page === "options" ? (
					<>
						<AppText variant="section">{t("quickLog.title")}</AppText>
						<View style={styles.actions}>
							<QuickLogAction
								icon="note"
								title={t("quickLog.note")}
								detail={t("quickLog.noteDetail")}
								onPress={() => choose("/notes/new")}
							/>
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
								icon="body"
								title={t("quickLog.body")}
								detail={t("quickLog.bodyDetail")}
								onPress={chooseBody}
							/>
							{nicotineEnabled ? (
								<QuickLogAction
									icon="drink"
									title={t("quickLog.nicotine")}
									detail={t("quickLog.nicotineDetail")}
									onPress={() => choose("/nicotine/log")}
								/>
							) : null}
							<QuickLogAction
								icon="check-in"
								title={t("quickLog.checkIn")}
								detail={t("quickLog.checkInDetail")}
								onPress={() => choose("/check-in")}
							/>
						</View>
					</>
				) : bodyLogSurface ? (
					bodyLogSurface.render({ close: closeSheet, backToQuickLog })
				) : (
					<View style={styles.loading}>
						<LoadingIndicator size="large" />
						<AppText color="muted">{t("quickLog.bodyLoading")}</AppText>
					</View>
				)}
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
	loading: { alignItems: "center", gap: theme.spacing.md },
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
