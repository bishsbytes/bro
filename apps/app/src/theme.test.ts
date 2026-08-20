import {
	ACCENT_OPTIONS,
	createTheme,
	darkTheme,
	lightTheme,
	stackScreenOptions,
} from "./theme/unistyles";

describe("design tokens", () => {
	it("defines every colour in both themes", () => {
		// A token present in one theme and missing from the other resolves to
		// undefined at runtime — invisible text rather than a loud failure. The
		// jest mock always returns the first registered theme, so this is the only
		// place dark mode can be checked without a device.
		expect(Object.keys(darkTheme.colors).sort()).toEqual(
			Object.keys(lightTheme.colors).sort(),
		);
	});

	it("does not carry a colour value across both themes unchanged", () => {
		// Widened deliberately: with `as const` the literal unions do not overlap
		// today, so TypeScript rejects the comparison as unintentional. The check
		// still earns its place, because it is a duplicate added later that this
		// catches — and at that point the unions would overlap.
		const light: Record<string, string> = lightTheme.colors;
		const dark: Record<string, string> = darkTheme.colors;
		const shared = Object.keys(light).filter((key) => light[key] === dark[key]);

		// Anything identical in both is almost certainly an unconverted hardcoded
		// value rather than a deliberate choice.
		expect(shared).toEqual([]);
	});

	it("shares non-colour tokens across themes", () => {
		expect(darkTheme.spacing).toEqual(lightTheme.spacing);
		expect(darkTheme.radius).toEqual(lightTheme.radius);
		expect(darkTheme.typography).toEqual(lightTheme.typography);
		expect(darkTheme.control).toEqual(lightTheme.control);
		expect(darkTheme.opacity).toEqual(lightTheme.opacity);
	});

	it("gives every curated accent a complete light and dark treatment", () => {
		for (const option of ACCENT_OPTIONS) {
			const light = createTheme("light", option.value);
			const dark = createTheme("dark", option.value);

			expect(Object.keys(light.colors).sort()).toEqual(
				Object.keys(lightTheme.colors).sort(),
			);
			expect(Object.keys(dark.colors).sort()).toEqual(
				Object.keys(darkTheme.colors).sort(),
			);
			expect(light.colors.brand).not.toBe(dark.colors.brand);
			expect(light.spacing).toBe(lightTheme.spacing);
			expect(dark.spacing).toBe(darkTheme.spacing);
		}
	});

	it("uses a distinct canvas and raised surface in each colour scheme", () => {
		expect(lightTheme.colors.background).not.toBe(lightTheme.colors.surface);
		expect(darkTheme.colors.background).not.toBe(darkTheme.colors.surface);
	});

	it("keeps native stacks aligned with the shared visual system", () => {
		expect(stackScreenOptions(lightTheme)).toMatchObject({
			headerStyle: { backgroundColor: lightTheme.colors.headerBackground },
			headerTintColor: lightTheme.colors.text,
			headerShadowVisible: false,
			contentStyle: { backgroundColor: lightTheme.colors.background },
		});
	});
});
