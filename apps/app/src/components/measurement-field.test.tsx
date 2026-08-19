import { fireEvent, render } from "@testing-library/react-native";
import { MeasurementField } from "./measurement-field";

describe("MeasurementField", () => {
	it("gives a compound unit one labelled field per part", async () => {
		const onChangeEntry = jest.fn();
		const view = await render(
			<MeasurementField
				label="Weight"
				unit="st"
				entry={{ major: "12", minor: "4" }}
				onChangeEntry={onChangeEntry}
			/>,
		);

		expect(view.getByLabelText("Weight (stones)").props.value).toBe("12");
		expect(view.getByLabelText("Weight (pounds)").props.value).toBe("4");
		expect(view.getByText("st")).toBeTruthy();
		expect(view.getByText("lb")).toBeTruthy();

		await fireEvent.changeText(view.getByLabelText("Weight (pounds)"), "6");
		expect(onChangeEntry).toHaveBeenCalledWith({ major: "12", minor: "6" });
	});

	it("keeps a numeric keyboard on both parts", async () => {
		const view = await render(
			<MeasurementField
				label="Height"
				unit="ft"
				entry={{ major: "5", minor: "11" }}
				onChangeEntry={jest.fn()}
			/>,
		);

		expect(view.getByLabelText("Height (feet)").props.keyboardType).toBe(
			"decimal-pad",
		);
		expect(view.getByLabelText("Height (inches)").props.keyboardType).toBe(
			"decimal-pad",
		);
	});

	it("gives a simple unit a single field naming its unit", async () => {
		const onChangeEntry = jest.fn();
		const view = await render(
			<MeasurementField
				label="Waist"
				unit="cm"
				entry={{ major: "84", minor: "" }}
				onChangeEntry={onChangeEntry}
			/>,
		);

		expect(view.queryByLabelText("Waist (centimetres)")).toBeNull();
		await fireEvent.changeText(view.getByLabelText("Waist (cm)"), "85");
		expect(onChangeEntry).toHaveBeenCalledWith({ major: "85", minor: "" });
	});

	it("names each part for a screen reader when given a base label", async () => {
		const view = await render(
			<MeasurementField
				label="Value"
				unit="st"
				accessibilityLabel="Edit Weight abc"
				entry={{ major: "12", minor: "4" }}
				onChangeEntry={jest.fn()}
			/>,
		);

		expect(view.getByLabelText("Edit Weight abc (stones)")).toBeTruthy();
		expect(view.getByLabelText("Edit Weight abc (pounds)")).toBeTruthy();
	});
});
