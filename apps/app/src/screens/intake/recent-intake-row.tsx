import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Icon } from "../../components/icon";
import type { PresentedIntakeEvent } from "../../intake/intake-store";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";
import { IntakeArtwork } from "./intake-artwork";

type RecentIntakeRowProps = {
	presented: PresentedIntakeEvent;
	disabled: boolean;
	onRepeat: () => void;
	onEdit: () => void;
};

/** Tap the row to edit the next amount, or plus to repeat the displayed portion. */
export function RecentIntakeRow({
	presented,
	disabled,
	onRepeat,
	onEdit,
}: RecentIntakeRowProps) {
	const { t } = useTranslation("intake");
	const { theme } = useUnistyles();
	const { event } = presented;

	return (
		<View style={styles.row}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("log.editAmountA11y", { name: event.name })}
				accessibilityState={{ disabled }}
				disabled={disabled}
				onPress={onEdit}
				style={styles.copy}
			>
				<IntakeArtwork
					name={event.name}
					brand={event.brand}
					kind={event.kind}
					sourceRef={event.sourceRef}
				/>
				<View style={styles.grow}>
					<AppText variant="label">{event.name}</AppText>
					<AppText variant="caption" color="muted">
						{t("entry.portion", {
							quantity: event.quantity,
							portion: event.portionLabel ?? t("event.defaultPortion"),
						})}
					</AppText>
				</View>
			</Pressable>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("log.repeatA11y", { name: event.name })}
				accessibilityHint={t("log.recentHint")}
				accessibilityState={{ disabled }}
				disabled={disabled}
				onPress={onRepeat}
				style={styles.repeat}
			>
				<Icon name="add" size={24} color={theme.colors.brand} />
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	row: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.card,
		width: "100%",
	},
	copy: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		padding: theme.spacing.sm,
		gap: theme.spacing.md,
		minHeight: theme.control.minHitArea,
	},
	grow: { flex: 1 },
	repeat: {
		minWidth: theme.control.minHitArea,
		minHeight: theme.control.minHitArea,
		alignItems: "center",
		justifyContent: "center",
		marginRight: theme.spacing.sm,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.surface3,
	},
}));
