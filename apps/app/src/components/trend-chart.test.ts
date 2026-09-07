import type { TrendSeries } from "@bro/logic";
import { fireEvent, render } from "@testing-library/react-native";
import { createElement } from "react";
import {
	TrendChart,
	terrainDateRangeLabel,
	terrainPolygonPoints,
	terrainYForValue,
} from "./trend-chart";

import { editorialChartScale } from "./trend-chart-plot";

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
	it("exposes selectable readings and an accessible text history", async () => {
		const onSelect = jest.fn();
		const view = await render(
			createElement(TrendChart, { series, onSelect, displayUnit: "kg" }),
		);
		await fireEvent(
			view.getByTestId("terrain-explorer"),
			"accessibilityAction",
			{ nativeEvent: { actionName: "decrement" } },
		);
		expect(onSelect).toHaveBeenLastCalledWith(series.points[0], "80.0 kg");
		await fireEvent.press(view.getByText("Show readings"));
		expect(view.getAllByText(/2026-08-29:/).length).toBeGreaterThan(0);
		expect(view.getByText(/2026-09-04:/)).toBeTruthy();
		await fireEvent.press(view.getByText("Back to latest"));
		expect(onSelect).toHaveBeenLastCalledWith(null, "");
	});

	it("renders earlier isolated measurements without joining gaps", async () => {
		const view = await render(
			createElement(TrendChart, {
				series: { ...series, segments: ["0.00,60.00", "300.00,85.00"] },
			}),
		);
		expect(view.getAllByTestId("terrain-isolated-reading")).toHaveLength(2);
	});

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

	it("draws a crisp current point with no glow layers", async () => {
		const view = await render(createElement(TrendChart, { series }));
		const marker = view.getByTestId("terrain-current-marker");
		expect(marker.props.cx).toBe(300);
		expect(marker.props.cy).toBe(85);
		expect(marker.props.filter).toBeFalsy();
		expect(view.queryByTestId("terrain-line-glow-0")).toBeNull();
	});
});

describe("compact editorial chart", () => {
	const dailySeries: TrendSeries = {
		...series,
		points: [
			{ localDay: "2026-09-01", value: 84.6 },
			{ localDay: "2026-09-02", value: 84.5 },
			{ localDay: "2026-09-03", value: null },
			{ localDay: "2026-09-04", value: 84.4 },
		],
		observedDayCount: 3,
		// A distant Heading must not flatten this reading chart.
		scale: { min: 40, max: 85 },
	};

	it("plots only actual readings and leaves missing days disconnected", async () => {
		const view = await render(
			createElement(TrendChart, {
				series: dailySeries,
				compact: true,
				displayUnit: "kg",
				usualRange: {
					min: 84.4,
					max: 84.6,
					minFormatted: "84.4 kg",
					maxFormatted: "84.6 kg",
				},
			}),
		);
		expect(view.getAllByTestId("trend-reading-dot")).toHaveLength(3);
		expect(view.getAllByTestId("trend-observed-run")).toHaveLength(1);
		expect(
			view.getByTestId("terrain-usual-corridor").props.height,
		).toBeGreaterThan(0);
		expect(view.queryByTestId("terrain-heading-line")).toBeNull();
	});

	it("keeps a narrow personal range away from the chart edges", () => {
		const scale = editorialChartScale(dailySeries.points, {
			min: 84.4,
			max: 84.6,
		});
		expect(scale.min).toBeLessThan(84.4);
		expect(scale.max).toBeGreaterThan(84.6);
		expect(scale.min).toBeGreaterThan(80);
		expect(scale.max).toBeLessThan(90);
	});

	it("uses the rendered plot inset when selecting a day by touch", async () => {
		const onSelect = jest.fn();
		const view = await render(
			createElement(TrendChart, {
				series: dailySeries,
				compact: true,
				displayUnit: "kg",
				onSelect,
			}),
		);
		const dot = view.getAllByTestId("trend-reading-dot")[1];
		await fireEvent(view.getByTestId("terrain-explorer"), "responderGrant", {
			nativeEvent: { locationX: dot.props.cx },
		});
		expect(onSelect).toHaveBeenLastCalledWith(dailySeries.points[1], "84.5 kg");
	});
});
