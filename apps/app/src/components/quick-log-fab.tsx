import type { ConsumableKind } from "@bro/domain/consumable";
import { OPTIONAL_STREAM_KINDS } from "@bro/domain/consumable";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { useBodyLogSurface } from "../body/body-log-surface-context";
import { playSelectionHaptic } from "../feedback/selection-haptic";
import { enabledIntakeKinds } from "../intake/intake-settings-store";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon, type IconName } from "./icon";
import { LoadingIndicator } from "./loading-indicator";
import { ModalSheet } from "./modal-sheet";

type QuickLogPage = "options" | "body";

type QuickLogActionProps = {
	icon: IconName;
	domain: "mind" | "body" | "load";
	title: string;
	detail: string;
	onPress: () => void;
};

function QuickLogAction({
	icon,
	domain,
	title,
	detail,
	onPress,
}: QuickLogActionProps) {
	const { theme } = useUnistyles();
	const domainColor = theme.colors[domain];

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={title}
			activeOpacity={0.72}
			style={styles.actionRow}
			onPress={onPress}
		>
			<View
				style={[
					styles.actionIcon,
					{ backgroundColor: theme.tint(domainColor) },
				]}
			>
				<Icon name={icon} color={domainColor} size={20} />
			</View>
			<View style={styles.actionCopy}>
				<AppText variant="label" style={styles.actionTitle}>
					{title}
				</AppText>
				<AppText variant="caption" color="muted">
					{detail}
				</AppText>
			</View>
			<Icon name="chevron-right" color={theme.colors.textSubtle} size={16} />
		</TouchableOpacity>
	);
}

/** The log screen, preset to one kind so muscle memory survives the merge. */
export function intakeLogHref(kind: ConsumableKind): Href {
	return `/intake/log?kind=${kind}` as Href;
}

export function QuickLogFab({
	bodyActive = false,
	enabledKinds = enabledIntakeKinds,
	surface = false,
}: {
	bottom?: number;
	bodyActive?: boolean;
	enabledKinds?: () => Promise<ConsumableKind[]>;
	surface?: boolean;
}) {
	const { t } = useTranslation("navigation");
	const { theme } = useUnistyles();
	const [open, setOpen] = useState(false);
	const [page, setPage] = useState<QuickLogPage>("options");
	const [optionalKinds, setOptionalKinds] = useState<ConsumableKind[]>([]);
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
	 * Eating and drinking are universal; every other stream is asked about
	 * before it is offered. A standing smoking or medication button in every
	 * man's sheet would be the product assuming something about him.
	 */
	function openSheet() {
		playSelectionHaptic();
		setOpen(true);
		enabledKinds()
			.then((kinds) =>
				setOptionalKinds(
					kinds.filter((kind) =>
						(OPTIONAL_STREAM_KINDS as readonly string[]).includes(kind),
					),
				),
			)
			.catch(() => setOptionalKinds([]));
	}

	return (
		<>
			<TouchableOpacity
				accessibilityRole="button"
				accessibilityLabel={t("quickLog.open")}
				activeOpacity={0.72}
				hitSlop={theme.spacing.sm}
				style={[styles.trigger, surface && styles.surfaceTrigger]}
				onPress={openSheet}
			>
				<View style={surface ? styles.triggerSurface : undefined}>
					<Icon name="add" color={theme.colors.ink2} size={surface ? 18 : 20} />
				</View>
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
								domain="mind"
								title={t("quickLog.note")}
								detail={t("quickLog.noteDetail")}
								onPress={() => choose("/notes/new")}
							/>
							<QuickLogAction
								icon="food"
								domain="body"
								title={t("quickLog.food")}
								detail={t("quickLog.foodDetail")}
								onPress={() => choose(intakeLogHref("food"))}
							/>
							<QuickLogAction
								icon="drink"
								domain="load"
								title={t("quickLog.drink")}
								detail={t("quickLog.drinkDetail")}
								onPress={() => choose(intakeLogHref("drink"))}
							/>
							<QuickLogAction
								icon="body"
								domain="body"
								title={t("quickLog.body")}
								detail={t("quickLog.bodyDetail")}
								onPress={chooseBody}
							/>
							{optionalKinds.map((kind) => (
								<QuickLogAction
									key={kind}
									icon="drink"
									domain="load"
									title={t(`quickLog.${kind}`)}
									detail={t(`quickLog.${kind}Detail`)}
									onPress={() => choose(intakeLogHref(kind))}
								/>
							))}
							<QuickLogAction
								icon="check-in"
								domain="mind"
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
	trigger: {
		width: theme.control.buttonMinHeight,
		height: theme.control.buttonMinHeight,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.pill,
		backgroundColor: "transparent",
	},
	surfaceTrigger: {
		width: 34,
		height: 34,
	},
	triggerSurface: {
		width: 34,
		height: 34,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.hairline,
		borderRadius: 11,
		backgroundColor: theme.colors.surface2,
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
		backgroundColor: theme.colors.surface1,
	},
	actionIcon: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.control,
	},
	actionCopy: { flex: 1, gap: theme.spacing.xs },
	actionTitle: { fontWeight: "700" },
}));
