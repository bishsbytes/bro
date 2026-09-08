import { darkTheme, lightTheme, stackScreenOptions } from "./theme/unistyles";

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

	it("tints the Android tab ripple from the indicator it settles into", () => {
		// A ripple unrelated to the indicator reads as two colours on one press
		// rather than the indicator arriving.
		for (const theme of [lightTheme, darkTheme]) {
			expect(theme.colors.tabRipple).toBe(`${theme.colors.tabIndicator}38`);
		}
	});

	it("shares non-colour tokens across themes", () => {
		expect(darkTheme.spacing).toEqual(lightTheme.spacing);
		expect(darkTheme.radius).toEqual(lightTheme.radius);
		expect(darkTheme.typography).toEqual(lightTheme.typography);
		expect(darkTheme.control).toEqual(lightTheme.control);
		expect(darkTheme.opacity).toEqual(lightTheme.opacity);
	});

	it("keeps every stacked surface distinct within a theme", () => {
		// The light appearance once mapped surface1, surface2 and surfaceSunk onto
		// one hex, so a pressed row, a control fill and the card beneath them all
		// rendered identically and borderless controls vanished into their card.
		const roles = ["background", "surface", "surface2", "surfaceSunk"] as const;
		for (const theme of [lightTheme, darkTheme]) {
			const values = roles.map((role) => theme.colors[role]);
			expect(new Set(values).size).toBe(roles.length);
		}
	});

	it("uses darker surfaces on the light canvas and lighter surfaces on the dark canvas", () => {
		for (const surface of ["surface", "surface2", "surfaceSunk"] as const) {
			expect(relativeLuminance(lightTheme.colors[surface])).toBeLessThan(
				relativeLuminance(lightTheme.colors.background),
			);
			expect(relativeLuminance(darkTheme.colors[surface])).toBeGreaterThan(
				relativeLuminance(darkTheme.colors.background),
			);
		}
	});

	it("meets text and control contrast on every resting surface", () => {
		for (const theme of [lightTheme, darkTheme]) {
			for (const background of ["canvas", "surface", "surface2"] as const) {
				expect(
					contrast(theme.colors.ink, theme.colors[background]),
				).toBeGreaterThanOrEqual(7);
				expect(
					contrast(theme.colors.ink2, theme.colors[background]),
				).toBeGreaterThanOrEqual(4.5);
				expect(
					contrast(theme.colors.interactiveBorder, theme.colors[background]),
				).toBeGreaterThanOrEqual(3);
			}
			// surfaceSunk is the transient pressed fill. It carries primary ink for
			// the length of a touch, so it is held to that and not to muted text or
			// to resting control borders, which never come to rest on it.
			expect(
				contrast(theme.colors.ink, theme.colors.surfaceSunk),
			).toBeGreaterThanOrEqual(7);
			expect(
				contrast(theme.colors.onAccent, theme.colors.accent),
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(theme.colors.onBrand, theme.colors.brand),
			).toBeGreaterThanOrEqual(4.5);
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
