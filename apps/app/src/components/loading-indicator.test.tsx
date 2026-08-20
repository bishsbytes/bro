import { render } from "@testing-library/react-native";
import * as themeModule from "../theme/unistyles";
import { LoadingIndicator } from "./loading-indicator";

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

describe("LoadingIndicator", () => {
	beforeEach(() => {
		mockThemeOverride = {
			...themeModule.lightTheme,
			colors: { ...themeModule.lightTheme.colors, brand: "accent-colour" },
		} as unknown as typeof themeModule.lightTheme;
	});

	it("spins in the accent colour rather than the platform default", async () => {
		const screen = await render(
			<LoadingIndicator testID="loader" size="large" />,
		);

		expect(screen.getByTestId("loader").props.color).toBe("accent-colour");
	});

	it("lets a caller state a colour for coloured surfaces", async () => {
		const screen = await render(
			<LoadingIndicator testID="loader" color="on-brand" />,
		);

		expect(screen.getByTestId("loader").props.color).toBe("on-brand");
	});
});
