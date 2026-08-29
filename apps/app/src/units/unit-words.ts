import type { UnitWordOverrides } from "@bro/domain";
import { i18n } from "../i18n";

/**
 * The wording for units that are spelled out inside a reading. Domain owns the
 * English; this replaces it with the reader's language, and is passed wherever
 * an alcohol or fluid volume is formatted.
 */
export function unitWords(): UnitWordOverrides {
	return {
		uk_unit: {
			one: i18n.t("settings:unitWords.uk_unit_one"),
			other: i18n.t("settings:unitWords.uk_unit_other"),
		},
		us_standard_drink: {
			one: i18n.t("settings:unitWords.us_standard_drink_one"),
			other: i18n.t("settings:unitWords.us_standard_drink_other"),
		},
		fl_oz_uk: {
			one: i18n.t("settings:unitWords.fl_oz_one"),
			other: i18n.t("settings:unitWords.fl_oz_other"),
		},
		fl_oz_us: {
			one: i18n.t("settings:unitWords.fl_oz_one"),
			other: i18n.t("settings:unitWords.fl_oz_other"),
		},
	};
}
