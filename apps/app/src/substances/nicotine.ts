import { getDb } from "@bro/database-app";
import { nicotineCatalogue, resolveNicotineEntry } from "../content";
import { i18n } from "../i18n";
import {
	createSubstanceStore,
	type SubstanceDescriptor,
	SubstanceStore,
} from "./substance-store";

/** Nicotine as the first configuration of the shared substance log. */
export const NICOTINE_DESCRIPTOR: SubstanceDescriptor<"nicotine_intake"> = {
	kind: "nicotine",
	metricSlug: "nicotine_intake",
	amountKey: "nicotineKg",
	catalogue: nicotineCatalogue,
	resolveEntry: resolveNicotineEntry,
	copy: {
		chooseCatalogue: () => i18n.t("nicotine:chooseCatalogue"),
		amountInvalid: () => i18n.t("nicotine:amountInvalid"),
		loadFailed: () => i18n.t("nicotine:loadFailed"),
		loadFailedBody: () => i18n.t("nicotine:loadFailedBody"),
		disclaimer: () => i18n.t("nicotine:today.disclaimer"),
		weekTotal: (value) => i18n.t("nicotine:today.weekTotal", { value }),
		quickAddEyebrow: () => i18n.t("nicotine:quickAdd.eyebrow"),
		quickAddEmpty: () => i18n.t("nicotine:quickAdd.empty"),
		quickAddOption: (item, serving) =>
			i18n.t("nicotine:quickAdd.option", { item, serving }),
		repeatA11y: (name) => i18n.t("nicotine:browse.logRecentA11y", { name }),
		browseTitle: () => i18n.t("nicotine:browse.catalogueTitle"),
		freeTitle: () => i18n.t("nicotine:browse.freeTitle"),
		freeDetail: () => i18n.t("nicotine:browse.freeDetail"),
		goals: () => i18n.t("nicotine:overview.goals"),
		goalsDetail: () => i18n.t("nicotine:overview.goalsDetail"),
		manageTitle: () => i18n.t("nicotine:overview.manageTitle"),
		dayEmpty: () => i18n.t("nicotine:day.empty"),
		dayEmptyBody: () => i18n.t("nicotine:day.emptyBody"),
		dayTotal: () => i18n.t("nicotine:day.total"),
		goalSummary: (target, current) =>
			i18n.t("nicotine:goals.summary", { target, current }),
		goalTargetReached: () => i18n.t("nicotine:goals.targetReached"),
		goalPercent: (percent) =>
			i18n.t("nicotine:goals.percentComplete", { percent }),
		goalTargetField: (unit) => i18n.t("nicotine:goals.targetField", { unit }),
		goalTargetDateField: () => i18n.t("nicotine:goals.targetDateField"),
		goalSave: () => i18n.t("nicotine:goals.save"),
		goalSetFor: (name) => i18n.t("nicotine:goals.setFor", { name }),
		goalAchieve: () => i18n.t("nicotine:goals.achieve"),
		goalAbandon: () => i18n.t("nicotine:goals.abandon"),
		goalNeedsLog: () => i18n.t("nicotine:goals.needsLog"),
	},
	routeBase: "/nicotine",
};

export type NicotineStore = SubstanceStore<"nicotine_intake">;

export function createNicotineStore(): NicotineStore {
	return createSubstanceStore(NICOTINE_DESCRIPTOR);
}

/**
 * Whether the nicotine stream is switched on for this user. The quick-log
 * sheet asks before offering the action: eating and drinking are universal,
 * smoking is neither, and an unasked-for smoking button in every man's FAB is
 * the product having a view about him.
 */
export async function isNicotineTracked(): Promise<boolean> {
	return await new SubstanceStore(NICOTINE_DESCRIPTOR, getDb()).isTracked();
}
