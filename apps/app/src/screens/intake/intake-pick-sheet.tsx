import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Icon } from "../../components/icon";
import type { LabelInputs } from "../../intake/free-entry";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";
import { IntakeArtwork } from "./intake-artwork";
import { IntakeFormSheet } from "./intake-form-sheet";
import { NUTRITION_LABELS } from "./intake-nutrition";
import {
	type IntakePick,
	pickArtworkRef,
	pickBrand,
	pickKind,
	pickName,
} from "./intake-pick";
import type { IntakeQuantityOption } from "./intake-quantity-field";
import { IntakeQuantityField } from "./intake-quantity-field";
import { IntakeRow } from "./intake-rows";
import { IntakeWhenFields } from "./intake-when-fields";

type IntakePickSheetProps = {
	pick: IntakePick | null;
	busy: boolean;
	error: string | null;
	/** Set when scaling the chosen amount could not produce a composition. */
	compositionError: string | null;
	valid: boolean;
	/** The amount control, resolved by the screen from the pick and the mode. */
	amount: {
		value: string;
		onChange: (value: string) => void;
		unit: string;
		step: number;
		options?: readonly IntakeQuantityOption[];
	};
	nutrition: LabelInputs;
	nutritionOpen: boolean;
	onToggleNutrition: () => void;
	today: string;
	localDay: string;
	time: string;
	onChangeDay: (day: string) => void;
	onChangeTime: (time: string) => void;
	onClose: () => void;
	onSave: () => void;
};

/** The amount and moment for one chosen item, and what that works out as. */
export function IntakePickSheet({
	pick,
	busy,
	error,
	compositionError,
	valid,
	amount,
	nutrition,
	nutritionOpen,
	onToggleNutrition,
	today,
	localDay,
	time,
	onChangeDay,
	onChangeTime,
	onClose,
	onSave,
}: IntakePickSheetProps) {
	const { t } = useTranslation(["intake", "common"]);
	const { theme } = useUnistyles();

	return (
		<IntakeFormSheet
			visible={pick !== null}
			onClose={onClose}
			busy={busy}
			title={t("intake:log.addEntry")}
			footer={
				<View style={styles.actions}>
					<Button
						label={t("intake:log.save")}
						loading={busy}
						disabled={!valid || compositionError !== null}
						onPress={onSave}
					/>
					<Button
						label={t("intake:log.cancel")}
						variant="secondary"
						disabled={busy}
						onPress={onClose}
					/>
				</View>
			}
		>
			{pick ? (
				<View style={styles.sheet}>
					<View>
						<AppText variant="largeTitle">{pickName(pick)}</AppText>
						{pickBrand(pick) ? (
							<AppText variant="caption" color="muted">
								{pickBrand(pick)}
							</AppText>
						) : null}
						{pick.type === "composition" && pick.provenance ? (
							<AppText variant="footnote" color="subtle">
								{pick.provenance}
							</AppText>
						) : null}
					</View>
					<IntakeArtwork
						hero
						name={pickName(pick)}
						brand={pickBrand(pick)}
						kind={pickKind(pick)}
						sourceRef={pickArtworkRef(pick)}
					/>
					<AppText variant="caption" color="muted" style={styles.sourceBadge}>
						{t(
							pick.type === "recent"
								? "intake:log.recordedItem"
								: pick.source.type === "system"
									? "intake:log.broItem"
									: "intake:log.savedItem",
						)}
					</AppText>
					<IntakeQuantityField
						label={t("intake:log.amount")}
						value={amount.value}
						onChange={amount.onChange}
						unit={amount.unit}
						step={amount.step}
						disabled={busy}
						options={amount.options}
					/>

					<AppText variant="caption" color="muted">
						{t("intake:log.amountHint")}
					</AppText>

					<IntakeWhenFields
						localDay={localDay}
						time={time}
						today={today}
						disabled={busy}
						onChangeDay={onChangeDay}
						onChangeTime={onChangeTime}
					/>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("intake:log.nutritionDetails")}
						accessibilityState={{ expanded: nutritionOpen, disabled: busy }}
						disabled={busy}
						onPress={onToggleNutrition}
						style={styles.detailRow}
					>
						<AppText style={styles.grow}>
							{t("intake:log.nutritionDetails")}
						</AppText>
						<Icon
							name={nutritionOpen ? "chevron-down" : "chevron-right"}
							size={20}
							color={theme.colors.ink2}
						/>
					</Pressable>
					{compositionError ? (
						<AppText color="danger" accessibilityRole="alert">
							{compositionError}
						</AppText>
					) : null}
					{nutritionOpen && valid ? (
						<View style={styles.section}>
							<AppText variant="caption" color="muted">
								{t("intake:log.forAmount")}
							</AppText>
							{Object.keys(nutrition).length ? (
								Object.entries(nutrition).map(([field, value]) => (
									<IntakeRow
										key={field}
										title={t(
											`intake:free.${NUTRITION_LABELS[field as keyof LabelInputs]}`,
										)}
										value={value}
									/>
								))
							) : (
								<AppText color="muted">
									{t("intake:log.nutritionUnknown")}
								</AppText>
							)}
						</View>
					) : null}
					{error ? (
						<AppText accessibilityRole="alert" color="danger">
							{error}
						</AppText>
					) : null}
				</View>
			) : null}
		</IntakeFormSheet>
	);
}

const styles = StyleSheet.create((theme) => ({
	sheet: { gap: theme.spacing.lg },
	section: { gap: theme.spacing.md },
	actions: { flexDirection: "column", gap: theme.spacing.sm },
	grow: { flex: 1 },
	sourceBadge: {
		alignSelf: "center",
		textAlign: "center",
		paddingHorizontal: theme.spacing.xl,
		paddingVertical: theme.spacing.sm,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.surface,
	},
	detailRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		minHeight: theme.control.buttonMinHeight,
		paddingVertical: theme.spacing.md,
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderColor: theme.colors.line,
	},
}));
