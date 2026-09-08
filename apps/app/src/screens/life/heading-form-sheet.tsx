import { localDayOf } from "@bro/domain";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { DateField } from "../../components/date-field";
import { FactorChip } from "../../components/factor-chip";
import { FormField } from "../../components/form-field";
import { FormSheet } from "../../components/form-sheet";
import type { LifeAreaOption } from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";

export type HeadingFormValues = {
	name: string;
	intent: string;
	areaSlug: string | null;
	startedOn: string;
	targetDate: string;
	note: string;
};

export function emptyHeadingForm(now: Date): HeadingFormValues {
	return {
		name: "",
		intent: "",
		areaSlug: null,
		startedOn: localDayOf(now),
		targetDate: "",
		note: "",
	};
}

type HeadingFormSheetProps = {
	visible: boolean;
	mode: "create" | "edit";
	values: HeadingFormValues;
	areaOptions: readonly LifeAreaOption[];
	busy: boolean;
	error?: string | null;
	onChange: (values: HeadingFormValues) => void;
	onClose: () => void;
	onSave: () => void;
};

/**
 * L04 Edit Heading. Everything here is a person's own words and dates; what a
 * measurable heading is read against is set where it is created and is not
 * editable, so an edit can never move the target its progress was measured to.
 */
export function HeadingFormSheet({
	visible,
	mode,
	values,
	areaOptions,
	busy,
	error,
	onChange,
	onClose,
	onSave,
}: HeadingFormSheetProps) {
	const { t } = useTranslation(["life", "common"]);
	const set = <Key extends keyof HeadingFormValues>(
		key: Key,
		value: HeadingFormValues[Key],
	) => onChange({ ...values, [key]: value });

	return (
		<FormSheet
			visible={visible}
			title={t(
				mode === "create" ? "heading.newEyebrow" : "heading.editEyebrow",
			)}
			busy={busy}
			onClose={onClose}
			footer={
				<Button
					label={t(mode === "create" ? "heading.create" : "heading.save")}
					loading={busy}
					onPress={onSave}
				/>
			}
		>
			<View style={styles.form}>
				<AppText variant="largeTitle">{t("heading.formTitle")}</AppText>
				<FormField
					label={t("heading.nameField")}
					value={values.name}
					autoCapitalize="sentences"
					editable={!busy}
					onChangeText={(text) => set("name", text)}
				/>
				<FormField
					label={t("heading.intentField")}
					value={values.intent}
					autoCapitalize="sentences"
					editable={!busy}
					onChangeText={(text) => set("intent", text)}
				/>
				<View style={styles.areas}>
					<AppText variant="label">{t("heading.areaField")}</AppText>
					<View style={styles.chips}>
						{areaOptions.map((area) => {
							const selected = values.areaSlug === area.slug;
							return (
								<FactorChip
									key={area.slug}
									label={area.label}
									selected={selected}
									disabled={busy}
									onPress={() => set("areaSlug", selected ? null : area.slug)}
								/>
							);
						})}
					</View>
				</View>
				<DateField
					label={t("heading.startField")}
					value={values.startedOn}
					onChangeDate={(day) => set("startedOn", day)}
				/>
				<DateField
					label={t("heading.targetDateField")}
					value={values.targetDate}
					allowClear
					onChangeDate={(day) => set("targetDate", day)}
				/>
				<FormField
					label={t("heading.noteField")}
					value={values.note}
					multiline
					autoCapitalize="sentences"
					editable={!busy}
					onChangeText={(text) => set("note", text)}
				/>
				{error ? <AppText color="danger">{error}</AppText> : null}
			</View>
		</FormSheet>
	);
}

const styles = StyleSheet.create((theme) => ({
	form: { gap: theme.spacing.lg, paddingTop: theme.spacing.sm },
	areas: { gap: theme.spacing.xs },
	chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
}));
