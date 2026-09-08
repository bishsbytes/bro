import type { ConsumableKind } from "@bro/domain/consumable";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FormField } from "../../components/form-field";
import { Icon } from "../../components/icon";
import type { LabelInputs } from "../../intake/free-entry";
import {
	labelInputsHaveValue,
	labelInputsValid,
} from "../../intake/free-entry";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";
import { IntakeFormSheet } from "./intake-form-sheet";
import {
	isPositiveNumber,
	NUTRITION_LABELS,
	NUTRITION_UNITS,
} from "./intake-nutrition";
import { IntakeQuantityField } from "./intake-quantity-field";
import { IntakeWhenFields } from "./intake-when-fields";

/** Everything the user types for something the app has never seen. */
export type FreeEntryDraft = {
	kind: ConsumableKind;
	name: string;
	portion: string;
	quantity: string;
	inputs: LabelInputs;
};

export const EMPTY_FREE_ENTRY: Omit<FreeEntryDraft, "kind"> = {
	name: "",
	portion: "",
	quantity: "1",
	inputs: {},
};

type IntakeFreeEntrySheetProps = {
	visible: boolean;
	busy: boolean;
	error: string | null;
	draft: FreeEntryDraft;
	onChange: (patch: Partial<FreeEntryDraft>) => void;
	enabledKinds: readonly ConsumableKind[];
	portionSuggestions: readonly string[];
	today: string;
	localDay: string;
	time: string;
	whenValid: boolean;
	onChangeDay: (day: string) => void;
	onChangeTime: (time: string) => void;
	onClose: () => void;
	onSave: () => void;
};

/** Which label fields are asked for; nicotine asks one thing, the rest expand. */
function nutritionFields(kind: ConsumableKind, more: boolean) {
	if (kind === "nicotine") return ["nicotineMg"] as const;
	if (more) {
		return [
			"energyKcal",
			"proteinG",
			"carbohydrateG",
			"fatG",
			"fluidMl",
			"abvPercent",
			"caffeineMg",
		] as const;
	}
	return kind === "drink"
		? (["energyKcal", "fluidMl"] as const)
		: (["energyKcal"] as const);
}

export function IntakeFreeEntrySheet({
	visible,
	busy,
	error,
	draft,
	onChange,
	enabledKinds,
	portionSuggestions,
	today,
	localDay,
	time,
	whenValid,
	onChangeDay,
	onChangeTime,
	onClose,
	onSave,
}: IntakeFreeEntrySheetProps) {
	const { t } = useTranslation(["intake", "common"]);
	const { theme } = useUnistyles();
	const [more, setMore] = useState(false);
	const fields = nutritionFields(draft.kind, more);
	const valid =
		draft.name.trim() !== "" &&
		isPositiveNumber(draft.quantity) &&
		labelInputsValid(draft.inputs) &&
		labelInputsHaveValue(draft.inputs);

	return (
		<IntakeFormSheet
			visible={visible}
			onClose={onClose}
			busy={busy}
			title={t("intake:library.newTitle")}
			footer={
				<View style={styles.actions}>
					<Button
						label={t("intake:free.save")}
						loading={busy}
						disabled={!valid || !whenValid}
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
			<View style={styles.sheet}>
				<AppText variant="largeTitle">{t("intake:free.title")}</AppText>
				<FormField
					label={t("intake:free.name")}
					placeholder={t("intake:free.namePlaceholder")}
					value={draft.name}
					editable={!busy}
					onChangeText={(name) => onChange({ name })}
				/>
				<View style={styles.section}>
					<AppText variant="label">{t("intake:free.type")}</AppText>
					<View
						style={styles.typeOptions}
						accessibilityRole="radiogroup"
						accessibilityLabel={t("intake:free.type")}
					>
						{enabledKinds.map((candidate) => (
							<Button
								key={candidate}
								accessibilityRole="radio"
								style={styles.typeOption}
								label={t(`intake:kinds.${candidate}`)}
								accessibilityState={{
									selected: draft.kind === candidate,
									checked: draft.kind === candidate,
								}}
								variant={draft.kind === candidate ? "primary" : "secondary"}
								disabled={busy}
								onPress={() => onChange({ kind: candidate })}
							/>
						))}
					</View>
				</View>

				<IntakeQuantityField
					label={t("intake:log.amount")}
					value={draft.quantity}
					onChange={(quantity) => onChange({ quantity })}
					unit={t("intake:event.defaultPortion")}
					unitInput={{
						value: draft.portion,
						onChange: (portion) => onChange({ portion }),
						suggestions: portionSuggestions,
					}}
					step={0.5}
					disabled={busy}
				/>
				<View style={styles.nutritionSection}>
					<AppText variant="label">{t("intake:free.nutritionTitle")}</AppText>
					{fields.map((field) => (
						<View key={field} style={styles.nutritionField}>
							<AppText variant="caption" style={styles.grow}>
								{t(`intake:nutrition.${NUTRITION_LABELS[field]}`)}
							</AppText>
							<FormField
								label={t(`intake:free.${NUTRITION_LABELS[field]}`)}
								showLabel={false}
								value={draft.inputs[field] ?? ""}
								onChangeText={(value) =>
									onChange({ inputs: { ...draft.inputs, [field]: value } })
								}
								keyboardType="decimal-pad"
								editable={!busy}
								containerStyle={styles.nutritionInput}
							/>
							<AppText
								variant="caption"
								color="muted"
								style={styles.nutritionUnit}
							>
								{NUTRITION_UNITS[field]}
							</AppText>
						</View>
					))}
					{draft.kind !== "nicotine" ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t(
								more ? "intake:free.fewerDetails" : "intake:free.moreDetails",
							)}
							accessibilityState={{ expanded: more, disabled: busy }}
							disabled={busy}
							onPress={() => setMore((current) => !current)}
							style={styles.moreDetails}
						>
							<Icon
								name={more ? "chevron-down" : "add"}
								size={16}
								color={theme.colors.brand}
							/>
							<AppText variant="caption" style={{ color: theme.colors.brand }}>
								{t(
									more ? "intake:free.fewerDetails" : "intake:free.moreDetails",
								)}
							</AppText>
						</Pressable>
					) : null}
					<AppText variant="caption" color="muted">
						{t("intake:free.detailsHint")}
					</AppText>
				</View>
				<IntakeWhenFields
					localDay={localDay}
					time={time}
					today={today}
					disabled={busy}
					onChangeDay={onChangeDay}
					onChangeTime={onChangeTime}
				/>

				{error ? (
					<AppText accessibilityRole="alert" color="danger">
						{error}
					</AppText>
				) : null}
			</View>
		</IntakeFormSheet>
	);
}

const styles = StyleSheet.create((theme) => ({
	sheet: { gap: theme.spacing.lg },
	section: { gap: theme.spacing.md },
	actions: { flexDirection: "column", gap: theme.spacing.sm },
	grow: { flex: 1 },
	typeOptions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: theme.spacing.xs,
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.pill,
	},
	typeOption: {
		flexGrow: 1,
		borderWidth: 0,
		minWidth: "40%",
	},
	nutritionSection: { gap: theme.spacing.sm },
	nutritionField: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		borderWidth: 1,
		borderColor: theme.colors.line,
		borderRadius: theme.radius.control,
		padding: theme.spacing.sm,
	},
	nutritionInput: { flex: 1, minWidth: 0 },
	nutritionUnit: { width: 32 },
	moreDetails: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.xs,
		minHeight: theme.control.minHitArea,
	},
}));
