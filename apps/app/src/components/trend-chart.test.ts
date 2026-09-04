import type { TrendSeries } from "@bro/logic";
import { render } from "@testing-library/react-native";
import { createElement } from "react";
import {
	TrendChart,
	terrainDateRangeLabel,
	terrainPolygonPoints,
	terrainYForValue,
} from "./trend-chart";

const series: TrendSeries = {
	metricSlug: "weight",
	points: [
		{ localDay: "2026-08-29", value: 80 },
		{ localDay: "2026-09-04", value: 75 },
	],
	segments: ["0.00,60.00 300.00,85.00"],
	markers: [
		{ localDay: "2026-08-29", x: 0, y: 60 },
		{ localDay: "2026-09-04", x: 300, y: 85 },
	],
	scale: { min: 70, max: 90 },
	observedDayCount: 2,
	daysUntilMeaningful: 5,
};

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

	it("positions values on the same scale as the trend line", () => {
		expect(terrainYForValue(90, series.scale)).toBe(10);
		expect(terrainYForValue(80, series.scale)).toBe(60);
		expect(terrainYForValue(70, series.scale)).toBe(110);
	});

	it("labels the local-day window", () => {
		expect(terrainDateRangeLabel(series, "en-GB")).toBe("29 Aug – 4 Sept");
	});

	it("draws and announces the user's actual usual range", async () => {
		const view = await render(
			createElement(TrendChart, {
				series,
				usualRange: {
					min: 75,
					max: 80,
					minFormatted: "75.0 kg",
					maxFormatted: "80.0 kg",
				},
			}),
		);

		const corridor = view.getByTestId("terrain-usual-corridor");
		expect(corridor.props.y).toBe(60);
		expect(corridor.props.height).toBe(25);
		expect(
			view.getByTestId("terrain-usual-max-label").props.children.props.children,
		).toBe("80.0 kg");
		expect(
			view.getByTestId("terrain-usual-min-label").props.children.props.children,
		).toBe("75.0 kg");
		expect(
			view.getByTestId("terrain-usual-range-label").props.children.props
				.children,
		).toBe("Usual range");
		expect(
			view.getByTestId("terrain-date-range-label").props.children.props
				.children,
		).toBe("Aug 29 – Sep 4");
		expect(
			view.getByLabelText("weight trend chart Usual range 75.0 kg to 80.0 kg."),
		).toBeTruthy();
	});

	it("plots and announces a heading as a dashed ink line", async () => {
		const view = await render(
			createElement(TrendChart, {
				series,
				heading: { value: 85, formatted: "85.0 kg" },
			}),
		);

		const line = view.getByTestId("terrain-heading-line");
		expect(line.props.y1).toBe(35);
		expect(line.props.y2).toBe(35);
		expect(line.props.strokeDasharray).toEqual(["4", "4"]);
		expect(
			view.getByTestId("terrain-heading-label").props.children.props.children,
		).toBe("85.0 kg heading");
		expect(
			view.getByLabelText("weight trend chart Heading 85.0 kg."),
		).toBeTruthy();
	});

	it("does not invent a usual corridor before one exists", async () => {
		const view = await render(createElement(TrendChart, { series }));

		expect(view.queryByTestId("terrain-usual-corridor")).toBeNull();
		expect(view.queryByTestId("terrain-usual-range-label")).toBeNull();
		expect(view.queryByTestId("terrain-heading-line")).toBeNull();
	});

	it("gives the trend line and current point dedicated glow layers", async () => {
		const view = await render(createElement(TrendChart, { series }));

		expect(view.getByTestId("terrain-line-glow-0").props.filter).toMatch(
			/^terrain-line-glow-/,
		);
		const lineEndGlow = view.getByTestId("terrain-line-end-glow");
		expect(lineEndGlow.props.cx).toBe(300);
		expect(lineEndGlow.props.cy).toBe(85);
		expect(lineEndGlow.props.filter).toMatch(/^terrain-line-glow-/);
		expect(view.getByTestId("terrain-current-glow").props.filter).toMatch(
			/^terrain-marker-glow-/,
		);
		expect(view.getByTestId("terrain-current-marker").props.filter).toBeFalsy();
	});
});
