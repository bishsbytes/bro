import { terrainPolygonPoints } from "./trend-chart";

describe("TrendChart", () => {
	it("closes a terrain segment against the baseline at its own edges", () => {
		expect(terrainPolygonPoints("120.00,60.00 180.00,30.00")).toBe(
			"120.00,60.00 180.00,30.00 180.00,110 120.00,110",
		);
	});

	it("keeps an isolated observation from filling across the chart", () => {
		expect(terrainPolygonPoints("270.00,45.00")).toBe(
			"270.00,45.00 270.00,110 270.00,110",
		);
	});
});
