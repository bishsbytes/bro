import { createDailyMetricId, createUuidV5 } from "./index";

describe("UUIDv5", () => {
	it("matches the RFC name-based UUID vector", () => {
		expect(
			createUuidV5("python.org", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"),
		).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
	});

	it("gives the same daily natural key the same id on every compute", () => {
		const first = createDailyMetricId("weight", "2026-08-16", "health_connect");
		const second = createDailyMetricId(
			"weight",
			"2026-08-16",
			"health_connect",
		);

		expect(first).toBe(second);
		expect(first).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(createDailyMetricId("weight", "2026-08-16", "healthkit")).not.toBe(
			first,
		);
	});

	it("rejects an invalid namespace", () => {
		expect(() => createUuidV5("name", "not-a-uuid")).toThrow(
			"namespace must be a valid UUID",
		);
	});
});
