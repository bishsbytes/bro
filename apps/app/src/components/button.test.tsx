import { fireEvent, render } from "@testing-library/react-native";
import { Button } from "./button";

describe("Button", () => {
	it("blocks presses while disabled or busy", async () => {
		const onPress = jest.fn();
		const screen = await render(
			<>
				<Button label="Disabled" disabled onPress={onPress} />
				<Button label="Saving" loading onPress={onPress} />
			</>,
		);

		await fireEvent.press(screen.getByRole("button", { name: "Disabled" }));
		await fireEvent.press(screen.getByRole("button", { name: "Saving" }));

		expect(onPress).not.toHaveBeenCalled();
	});
});
