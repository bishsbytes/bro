import { LIFE_AREA_CATALOGUE } from "@bro/domain/life-area-catalogue";
import { resolveMetric } from "../content";
import { unitWords } from "../units/unit-words";
import { i18n, resolveLanguage, upperCaseForLanguage } from ".";
import { pseudoLocaliseString } from "./pseudo";

function resolveLifeAreaLabel(slug: string): string {
	const area = LIFE_AREA_CATALOGUE.find((candidate) => candidate.slug === slug);
	if (!area) throw new Error(`Unknown life area ${slug}.`);
	return area.label;
}

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

describe("language-aware presentation", () => {
	it("uses the copy language's casing rules", () => {
		expect(upperCaseForLanguage("insight", "tr")).toBe("İNSİGHT");
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
		expect(unitWords().uk_unit?.(1)).toBe("unit");
		expect(unitWords().uk_unit?.(2)).toBe("units");
	});
});

describe("pseudoLocaliseString", () => {
	it("accents the copy so untranslated ASCII stands out", () => {
		expect(pseudoLocaliseString("Goals")).toBe("⟦Ǵóáĺś··⟧");
	});

	it("leaves placeholders alone so interpolation still resolves", () => {
		const pseudo = pseudoLocaliseString("Started at {{value}}");
		expect(pseudo).toContain("{{value}}");
		expect(pseudo).toMatch(/^⟦/);
		expect(pseudo).toMatch(/⟧$/);
	});

	it("pads from the visible text, not the placeholder", () => {
		// "Target " is what a reader sees; the padding must not grow with the
		// length of the token that gets substituted away.
		expect(pseudoLocaliseString("Target {{value}}")).toBe(
			"⟦Ťáŕǵéť {{value}}···⟧",
		);
	});
});

describe("authored content", () => {
	// The English half of `content` is derived from the domain catalogues, so a
	// missing translation degrades to the authored wording rather than a key.
	it("derives English from the domain catalogues", () => {
		expect(i18n.t("content:metrics.mood")).toBe("Mood");
		expect(i18n.t("content:lifeAreas.career")).toBe(
			resolveLifeAreaLabel("wheel:career"),
		);
	});

	it("reads authored copy back through the content accessors", () => {
		const mood = resolveMetric("mood");
		if (mood.kind !== "known") throw new Error("Expected a known metric.");
		expect(mood.metric.label).toBe("Mood");
	});

	it("prefers a translation over the authored wording", () => {
		i18n.addResourceBundle(
			"en",
			"content",
			{ metrics: { mood: "Mood today" } },
			true,
			true,
		);
		try {
			const mood = resolveMetric("mood");
			if (mood.kind !== "known") throw new Error("Expected a known metric.");
			expect(mood.metric.label).toBe("Mood today");
			// A metric the bundle does not mention keeps its authored wording.
			const energy = resolveMetric("energy");
			if (energy.kind !== "known") throw new Error("Expected a known metric.");
			expect(energy.metric.label).toBe("Energy");
		} finally {
			i18n.addResourceBundle(
				"en",
				"content",
				{ metrics: { mood: "Mood" } },
				true,
				true,
			);
		}
	});
});
