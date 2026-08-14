import { render } from "@testing-library/react-native";
import { FormField } from "./form-field";

describe("FormField", () => {
	it("labels the input and renders its error", async () => {
		const screen = await render(
			<FormField label="Email" value="" error="Enter a valid email" />,
		);

		expect(screen.getByLabelText("Email")).toBeTruthy();
		expect(screen.getByText("Enter a valid email")).toBeTruthy();
	});
});
