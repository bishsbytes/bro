import type { UnitWordOverrides } from "@bro/domain";
import { i18n } from "../i18n";

/**
 * The wording for units that are spelled out inside a reading. Domain owns the
 * English; this replaces it with the reader's language, and is passed wherever
 * an alcohol or fluid volume is formatted.
 */
export function unitWords(): UnitWordOverrides {
	return {
		uk_unit: (count) => i18n.t("settings:unitWords.uk_unit", { count }),
		us_standard_drink: (count) =>
			i18n.t("settings:unitWords.us_standard_drink", { count }),
		fl_oz_uk: (count) => i18n.t("settings:unitWords.fl_oz", { count }),
		fl_oz_us: (count) => i18n.t("settings:unitWords.fl_oz", { count }),
		salt_g: (count) => i18n.t("settings:unitWords.salt_g", { count }),
	};
}
