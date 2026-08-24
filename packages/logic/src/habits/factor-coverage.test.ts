import { coveredFactorSlugs, habitFactorSlug } from "./factor-coverage";

describe("habit factor coverage", () => {
	it("resolves the factor a manual habit stands in for", () => {
		expect(habitFactorSlug("habit:training")).toBe("training");
		expect(habitFactorSlug("habit:outdoors")).toBe("outdoors");
	});

	it("covers no factor for habits that measure their own metric", () => {
		expect(habitFactorSlug("habit:steps-10k")).toBeNull();
		expect(habitFactorSlug("habit:alcohol-free")).toBeNull();
	});

	it("fails safe for custom and retired habit slugs", () => {
		expect(habitFactorSlug("habit:custom:cold-plunge")).toBeNull();
		expect(habitFactorSlug("habit:retired")).toBeNull();
	});

	it("collects the factors active habits already record", () => {
		expect(
			coveredFactorSlugs([
				{ slug: "habit:training", removedAt: null },
				{ slug: "habit:outdoors", removedAt: null },
				{ slug: "habit:reading", removedAt: null },
			]),
		).toEqual(new Set(["training", "outdoors"]));
	});

	it("releases a factor back to the panel when its habit is removed", () => {
		expect(
			coveredFactorSlugs([
				{ slug: "habit:training", removedAt: 1_000 },
				{ slug: "habit:outdoors", removedAt: null },
			]),
		).toEqual(new Set(["outdoors"]));
	});
});
