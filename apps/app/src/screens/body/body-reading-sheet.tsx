import { localDayOf, localTimeOf, resolveLocalMoment } from "@bro/domain";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type {
	BodyMeasurementDraft,
	BodyMetricSummary,
} from "../../body/body-store";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { EventWhenFields } from "../../components/event-when-fields";
import { FormSheet } from "../../components/form-sheet";
import { MeasurementField } from "../../components/measurement-field";
import {
	EMPTY_ENTRY,
	parseMeasurementInput,
} from "../../measurements/measurement-entry";
import { StyleSheet } from "../../theme/unistyles";

export function BodyReadingSheet({
	metric,
	locale,
	busy,
	error,
	onSave,
	onClose,
}: {
	metric: BodyMetricSummary;
	locale?: string;
	busy: boolean;
	error: string | null;
	onSave: (draft: BodyMeasurementDraft) => void;
	onClose: () => void;
}) {
	const { t } = useTranslation(["body", "common"]);
	const [entry, setEntry] = useState(EMPTY_ENTRY);
	const [day, setDay] = useState(() => localDayOf(new Date()));
	const [time, setTime] = useState(() => localTimeOf(Date.now()));
	const [fieldError, setFieldError] = useState<string | null>(null);
	const [dateError, setDateError] = useState<string | null>(null);
	const presentation = metric.editablePresentation;
	if (!presentation) return null;
	function save() {
		if (!presentation || busy) return;
		const parsed = parseMeasurementInput(entry, presentation, locale);
		if (!parsed.ok) {
			setFieldError(parsed.error);
			return;
		}
		setFieldError(null);
		try {
			const moment = resolveLocalMoment({ localDay: day, time });
			setDateError(null);
			onSave({
				metricSlug: metric.metricSlug,
				canonicalValue: parsed.canonicalValue,
				observedAt: moment.occurredAt,
			});
		} catch {
			setDateError(t("body:log.invalidDate"));
		}
	}
	return (
		<FormSheet
			visible
			title={t("body:log.newReading")}
			busy={busy}
			onClose={onClose}
			footer={
				<>
					<Button
						label={t("body:log.saveReading")}
						loading={busy}
						onPress={save}
					/>
					<Button
						label={t("common:datePicker.cancel")}
						variant="secondary"
						disabled={busy}
						onPress={onClose}
					/>
				</>
			}
		>
			<View style={styles.content}>
				<AppText variant="largeTitle">{t("body:log.addTitle")}</AppText>
				<MeasurementField
					label={metric.label}
					unit={presentation.displayUnit}
					entry={entry}
					onChangeEntry={setEntry}
					error={fieldError}
					editable={!busy}
				/>
				<EventWhenFields
					localDay={day}
					time={time}
					today={localDayOf(new Date())}
					disabled={busy}
					onChangeDay={setDay}
					onChangeTime={setTime}
				/>
				<AppText variant="caption" color="muted">
					{t("body:history.source", { source: t("body:reading.manual") })}
				</AppText>
				{dateError || error ? (
					<AppText accessibilityRole="alert" color="danger">
						{dateError ?? error}
					</AppText>
				) : null}
			</View>
		</FormSheet>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.xl },
}));
