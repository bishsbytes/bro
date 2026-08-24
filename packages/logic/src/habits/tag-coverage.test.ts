import { coveredTagSlugs, habitTagSlug } from "./tag-coverage";

describe("habit tag coverage", () => {
	it("resolves the tag a manual habit stands in for", () => {
		expect(habitTagSlug("habit:training")).toBe("training");
		expect(habitTagSlug("habit:outdoors")).toBe("outdoors");
	});

	it("covers no tag for habits that measure their own metric", () => {
		expect(habitTagSlug("habit:steps-10k")).toBeNull();
		expect(habitTagSlug("habit:alcohol-free")).toBeNull();
	});

	it("fails safe for custom and retired habit slugs", () => {
		expect(habitTagSlug("habit:custom:cold-plunge")).toBeNull();
		expect(habitTagSlug("habit:retired")).toBeNull();
	});

	it("collects the tags active habits already record", () => {
		expect(
			coveredTagSlugs([
				{ slug: "habit:training", removedAt: null },
				{ slug: "habit:outdoors", removedAt: null },
				{ slug: "habit:reading", removedAt: null },
			]),
		).toEqual(new Set(["training", "outdoors"]));
	});

	it("releases a tag back to the panel when its habit is removed", () => {
		expect(
			coveredTagSlugs([
				{ slug: "habit:training", removedAt: 1_000 },
				{ slug: "habit:outdoors", removedAt: null },
			]),
		).toEqual(new Set(["outdoors"]));
	});
});
