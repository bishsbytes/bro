import { createTheme } from "../theme/unistyles";
import { switchColors } from "./themed-switch";

describe("ThemedSwitch", () => {
	it("uses a solid accent thumb over a tonal accent track on Android", () => {
		const theme = createTheme("light", 145, 0.055);

		expect(switchColors(theme, true, "android")).toEqual({
			trackColor: {
				false: theme.colors.border,
				true: theme.colors.selected,
			},
			thumbColor: theme.colors.brand,
		});
		expect(switchColors(theme, false, "android").thumbColor).toBe(
			theme.colors.textSubtle,
		);
	});

	it.each(["light", "dark"] as const)(
		"themes the web thumb in %s appearance",
		(mode) => {
			const theme = createTheme(mode, 145, 0.055);
			expect(switchColors(theme, true, "web").thumbColor).toBe(
				theme.colors.onBrand,
			);
			expect(switchColors(theme, false, "web").thumbColor).toBe(
				theme.colors.textMuted,
			);
		},
	);

	it("preserves the native iOS thumb treatment", () => {
		const theme = createTheme("dark", 318, 0.055);

		expect(switchColors(theme, true, "ios")).toEqual({
			trackColor: {
				false: theme.colors.border,
				true: theme.colors.brand,
			},
			thumbColor: undefined,
		});
	});
});
