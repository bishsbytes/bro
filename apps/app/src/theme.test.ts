import {
	ACCENT_OPTIONS,
	createTheme,
	darkTheme,
	lightTheme,
	stackScreenOptions,
} from "./theme/unistyles";

function relativeLuminance(hex: string): number {
	const channels = hex
		.slice(1)
		.match(/.{2}/g)
		?.map((part) => Number.parseInt(part, 16) / 255);
	if (channels?.length !== 3) throw new Error(`Bad colour: ${hex}`);
	const [red, green, blue] = channels.map((channel) =>
		channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
	);
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
	const light = Math.max(relativeLuminance(first), relativeLuminance(second));
	const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
	return (light + 0.05) / (dark + 0.05);
}

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
			const light = createTheme("light", option.hue, option.chroma);
			const dark = createTheme("dark", option.hue, option.chroma);

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

	it("meets Helm text contrast in both schemes and every accent", () => {
		for (const scheme of ["light", "dark"] as const) {
			for (const option of ACCENT_OPTIONS) {
				const theme = createTheme(scheme, option.hue, option.chroma);
				expect(
					contrast(theme.colors.ink, theme.colors.canvas),
				).toBeGreaterThanOrEqual(7);
				expect(
					contrast(theme.colors.ink2, theme.colors.canvas),
				).toBeGreaterThanOrEqual(4.5);
				expect(
					contrast(theme.colors.onAccent, theme.colors.accent),
				).toBeGreaterThanOrEqual(4.5);
			}
		}
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
