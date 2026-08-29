import { i18n, nonBreaking, resolveLanguage } from ".";

describe("resolveLanguage", () => {
	it("takes the first tag whose base language we ship copy in", () => {
		expect(resolveLanguage(["fr-FR", "en-GB"])).toBe("en");
	});

	it("matches a region tag against the language catalogue", () => {
		expect(resolveLanguage(["en-US"])).toBe("en");
		expect(resolveLanguage(["EN_gb"])).toBe("en");
	});

	it("falls back when the device asks for nothing we ship", () => {
		expect(resolveLanguage(["fr-FR", "de"])).toBe("en");
		expect(resolveLanguage([])).toBe("en");
	});
});

describe("nonBreaking", () => {
	it("keeps a short label on one line without putting the character in a catalogue", () => {
		expect(nonBreaking("Take stock")).toBe("Take\u00a0stock");
	});
});

describe("catalogues", () => {
	// Guards the init options rather than the wording: were i18next to
	// initialise asynchronously, or a namespace go unregistered, these would
	// return the key itself and every screen would render raw keys.
	it("resolves copy synchronously across namespaces", () => {
		expect(i18n.isInitialized).toBe(true);
		expect(i18n.t("common:actions.tryAgain")).toBe("Try again");
		expect(i18n.t("review:history.emptyTitle")).toBe("No reviews yet");
	});

	it("interpolates and pluralises", () => {
		expect(i18n.t("review:goals.achieve", { goal: "Sleep" })).toBe(
			"Mark Sleep achieved",
		);
		expect(i18n.t("review:history.lifeAreas", { count: 1 })).toBe(
			"1 life area",
		);
		expect(i18n.t("review:history.lifeAreas", { count: 8 })).toBe(
			"8 life areas",
		);
	});
});
