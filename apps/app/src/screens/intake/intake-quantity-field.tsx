import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FormField } from "../../components/form-field";
import { Icon } from "../../components/icon";
import { ModalSheet, SheetTextInput } from "../../components/modal-sheet";
import { OptionRow } from "../../components/option-row";
import { SectionHeader } from "../../components/section-header";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

/** One choice in the amount control: a portion, or the basis unit itself. */
export type IntakeQuantityOption = {
	id: string;
	label: string;
	accessibilityLabel?: string;
	selected: boolean;
	onSelect: () => void;
};

export function IntakeQuantityField({
	label,
	value,
	unit,
	step,
	disabled = false,
	onChange,
	options,
	unitInput,
}: {
	label: string;
	value: string;
	unit: string;
	step: number;
	disabled?: boolean;
	onChange: (value: string) => void;
	unitInput?: {
		value: string;
		onChange: (value: string) => void;
		suggestions: readonly string[];
	};
	options?: readonly IntakeQuantityOption[];
}) {
	const { t } = useTranslation("intake");
	const { theme } = useUnistyles();
	const [expanded, setExpanded] = useState(false);
	const [portionSearch, setPortionSearch] = useState("");
	const query = portionSearch.trim();
	const displayedUnit = unitInput?.value || unit;
	const closePortions = () => {
		setExpanded(false);
		Keyboard.dismiss();
	};
	const portionOptions = unitInput?.suggestions ?? [];
	const availablePortions = portionOptions.some(
		(portion) =>
			portion.toLocaleLowerCase() === displayedUnit.toLocaleLowerCase(),
	)
		? portionOptions
		: [...portionOptions, displayedUnit];
	const suggestions = availablePortions.filter((suggestion) =>
		suggestion.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
	);
	const canAdd =
		query !== "" &&
		!availablePortions.some(
			(suggestion) =>
				suggestion.toLocaleLowerCase() === query.toLocaleLowerCase(),
		);
	const selectUnit = (selection: string) => {
		if (disabled) return;
		unitInput?.onChange(selection);
		closePortions();
	};
	const number = Number(value);
	const valid = value.trim() !== "" && Number.isFinite(number) && number > 0;
	const change = (direction: number) => {
		const next = (valid ? number : 0) + direction * step;
		onChange(String(Number(Math.max(step, next).toFixed(6))));
	};
	return (
		<View style={styles.field}>
			<AppText variant="label">{label}</AppText>
			<View style={styles.row}>
				<View style={styles.stepper}>
					<Button
						label="−"
						accessibilityLabel={t("log.fewer")}
						variant="text"
						disabled={disabled || !valid || number <= step}
						style={styles.step}
						onPress={() => change(-1)}
					/>
					<FormField
						label={label}
						showLabel={false}
						value={value}
						onChangeText={onChange}
						onFocus={() => setExpanded(false)}
						keyboardType="decimal-pad"
						editable={!disabled}
						containerStyle={styles.grow}
						style={styles.input}
					/>
					<Button
						label="+"
						accessibilityLabel={t("log.more")}
						variant="text"
						disabled={disabled}
						style={styles.step}
						onPress={() => change(1)}
					/>
				</View>
				{unitInput || options ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t(
							unitInput ? "free.choosePortion" : "log.chooseUnit",
						)}
						accessibilityValue={{ text: displayedUnit }}
						accessibilityState={{ expanded, disabled }}
						disabled={disabled}
						onPress={() => {
							Keyboard.dismiss();
							setPortionSearch("");
							setExpanded((current) => !current);
						}}
						style={styles.unit}
					>
						<AppText variant="caption" style={styles.unitText}>
							{displayedUnit}
						</AppText>
						<Icon name="chevron-down" size={16} color={theme.colors.ink2} />
					</Pressable>
				) : (
					<View style={styles.unit}>
						<AppText variant="caption" style={styles.unitText}>
							{displayedUnit}
						</AppText>
					</View>
				)}
			</View>
			{unitInput || options ? (
				<ModalSheet
					sizing={unitInput ? "expanded" : "content"}
					visible={expanded && !disabled}
					onClose={closePortions}
					closeAccessibilityLabel={t("free.closePortions")}
				>
					<SectionHeader
						title={t(unitInput ? "free.choosePortion" : "log.chooseUnit")}
						action={
							<Button
								label={t("log.close")}
								accessibilityLabel={t("free.closePortions")}
								variant="text"
								onPress={closePortions}
							/>
						}
					/>
					{unitInput ? (
						<>
							<FormField
								inputComponent={SheetTextInput}
								label={t("free.searchPortions")}
								showLabel={false}
								placeholder={t("free.searchPortions")}
								accessibilityHint={t("free.portionHint")}
								value={portionSearch}
								onChangeText={setPortionSearch}
								autoCapitalize="none"
								autoCorrect={false}
								returnKeyType="done"
								onSubmitEditing={() => {
									if (query)
										selectUnit(
											suggestions.find(
												(suggestion) =>
													suggestion.toLocaleLowerCase() ===
													query.toLocaleLowerCase(),
											) ?? query,
										);
								}}
							/>
							{canAdd ? (
								<Button
									label={t("free.addPortion", { portion: query })}
									onPress={() => selectUnit(query)}
								/>
							) : null}
						</>
					) : null}
					<View
						accessibilityRole="radiogroup"
						accessibilityLabel={t(
							unitInput ? "free.choosePortion" : "log.chooseUnit",
						)}
						style={styles.options}
					>
						{unitInput
							? suggestions.map((suggestion) => (
									<OptionRow
										key={suggestion}
										label={suggestion}
										accessibilityLabel={suggestion}
										selected={
											suggestion.toLocaleLowerCase() ===
											displayedUnit.toLocaleLowerCase()
										}
										onPress={() => selectUnit(suggestion)}
									/>
								))
							: options?.map((option) => (
									<OptionRow
										key={option.id}
										label={option.label}
										accessibilityLabel={
											option.accessibilityLabel ?? option.label
										}
										selected={option.selected}
										disabled={disabled}
										onPress={() => {
											option.onSelect();
											closePortions();
										}}
									/>
								))}
					</View>
				</ModalSheet>
			) : null}
			{!valid ? (
				<AppText accessibilityRole="alert" variant="caption" color="danger">
					{t("log.quantityError")}
				</AppText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	field: { gap: theme.spacing.sm },
	row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
	stepper: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.control,
	},
	step: { width: theme.control.minHitArea, paddingHorizontal: 0 },
	grow: { flex: 1, minWidth: 0 },
	input: {
		textAlign: "center",
		paddingHorizontal: theme.spacing.xs,
		...theme.typography.monoList,
	},
	unit: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing.sm,
		minWidth: theme.control.minHitArea,
		maxWidth: "40%",
		minHeight: theme.control.buttonMinHeight,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
		borderWidth: 1,
		borderColor: theme.colors.interactiveBorder,
		borderRadius: theme.radius.control,
	},
	unitText: { flexShrink: 1, textAlign: "center" },
	options: { gap: theme.spacing.sm },
}));
