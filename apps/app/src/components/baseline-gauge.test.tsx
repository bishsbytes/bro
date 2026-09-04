import { render } from "@testing-library/react-native";
import {
	type StyleProp,
	StyleSheet,
	type TextStyle,
	type ViewStyle,
} from "react-native";
import { lightTheme } from "../theme/unistyles";
import { BaselineGauge } from "./baseline-gauge";

function flat(style: StyleProp<ViewStyle>): ViewStyle {
	return StyleSheet.flatten(style) ?? {};
}

describe("BaselineGauge", () => {
	it("places both readings on the rail in proportion to it", async () => {
		const view = await render(
			<BaselineGauge
				label="Waist"
				value="86.5"
				unit="cm"
				rail={{ min: 80, max: 100 }}
				railLabels={{ min: "80.0 cm", max: "100.0 cm" }}
				band={{ min: 85, max: 90 }}
				current={86}
				previous={88}
				accessibilityLabel="Waist, 86.5 cm"
			/>,
		);

		expect(flat(view.getByTestId("gauge-marker").props.style).left).toBe("30%");
		expect(flat(view.getByTestId("gauge-previous").props.style).left).toBe(
			"40%",
		);
		const band = flat(view.getByTestId("gauge-band").props.style);
		expect(band.left).toBe("25%");
		expect(band.width).toBe("25%");
	});

	it("keeps a reading past the end of the rail on the rail", async () => {
		const view = await render(
			<BaselineGauge
				label="Waist"
				value="120.0"
				unit="cm"
				rail={{ min: 80, max: 100 }}
				railLabels={{ min: "80.0 cm", max: "100.0 cm" }}
				current={120}
				previous={40}
				accessibilityLabel="Waist, 120.0 cm"
			/>,
		);

		expect(flat(view.getByTestId("gauge-marker").props.style).left).toBe(
			"100%",
		);
		expect(flat(view.getByTestId("gauge-previous").props.style).left).toBe(
			"0%",
		);
	});

	it("draws no band and no previous mark until there is something to draw", async () => {
		const view = await render(
			<BaselineGauge
				label="Neck"
				value="39.5"
				unit="cm"
				rail={{ min: 38, max: 41 }}
				railLabels={{ min: "38.0 cm", max: "41.0 cm" }}
				current={39.5}
				accessibilityLabel="Neck, 39.5 cm"
			/>,
		);

		expect(view.queryByTestId("gauge-band")).toBeNull();
		expect(view.queryByTestId("gauge-previous")).toBeNull();
		expect(view.getByTestId("gauge-marker")).toBeTruthy();
	});

	it("uses the measurement domain for the current marker glow", async () => {
		const view = await render(
			<BaselineGauge
				label="Sleep"
				value="7:12"
				rail={{ min: 4, max: 10 }}
				railLabels={{ min: "4h", max: "10h" }}
				current={7.2}
				domain="sleep"
				accessibilityLabel="Sleep, 7 hours 12 minutes"
			/>,
		);

		const markerCap = view.getByTestId("gauge-marker").props.children[0];
		const style = flat(markerCap.props.style);
		expect(style.boxShadow).toEqual([
			{
				offsetX: 0,
				offsetY: 0,
				blurRadius: lightTheme.readingMarker.glow,
				color: lightTheme.colors.sleep,
			},
		]);
	});

	it("renders the unit with caption typography", async () => {
		const view = await render(
			<BaselineGauge
				label="Waist"
				value="86.5"
				unit="cm"
				rail={{ min: 80, max: 100 }}
				railLabels={{ min: "80.0 cm", max: "100.0 cm" }}
				current={86.5}
				accessibilityLabel="Waist, 86.5 cm"
			/>,
		);

		const unitStyle = StyleSheet.flatten(
			view.getByTestId("gauge-unit").props.style as StyleProp<TextStyle>,
		);
		expect(unitStyle?.fontSize).toBe(lightTheme.typography.monoInline.fontSize);
		expect(unitStyle?.fontSize).not.toBe(lightTheme.typography.metric.fontSize);
	});

	it("supports a metric with no readings", async () => {
		const view = await render(
			<BaselineGauge
				label="Body fat"
				value="—"
				read="Nothing logged yet"
				accessibilityLabel="Body fat, —. Nothing logged yet"
			/>,
		);

		expect(view.queryByTestId("gauge-marker")).toBeNull();
		expect(view.getByLabelText("Body fat, —. Nothing logged yet")).toBeTruthy();
	});
});
