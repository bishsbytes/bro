import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet as NativeStyleSheet } from "react-native";
import * as themeModule from "../theme/unistyles";
import { Button } from "./button";

let mockThemeOverride: unknown;

jest.mock("../theme/unistyles", () => {
	const actual = jest.requireActual("../theme/unistyles");
	return {
		...actual,
		useUnistyles: () =>
			mockThemeOverride
				? { theme: mockThemeOverride, rt: {} }
				: actual.useUnistyles(),
	};
});

describe("Button", () => {
	beforeEach(() => {
		mockThemeOverride = undefined;
	});

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

	it("keeps secondary copy neutral while text actions may use the accent", async () => {
		const themed = {
			...themeModule.lightTheme,
			colors: {
				...themeModule.lightTheme.colors,
				text: "neutral-text",
				brand: "accent-colour",
			},
		} as unknown as typeof themeModule.lightTheme;
		mockThemeOverride = themed;

		const screen = await render(
			<>
				<Button label="Secondary" variant="secondary" />
				<Button label="Text" variant="text" />
			</>,
		);

		expect(
			NativeStyleSheet.flatten(screen.getByText("Secondary").props.style).color,
		).toBe("neutral-text");
		expect(
			NativeStyleSheet.flatten(screen.getByText("Text").props.style).color,
		).toBe("accent-colour");
	});
});
