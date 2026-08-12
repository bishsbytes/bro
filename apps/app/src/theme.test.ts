import { darkTheme, lightTheme } from "./theme/unistyles";

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

	it("shares spacing, radius, and typography across themes", () => {
		expect(darkTheme.spacing).toEqual(lightTheme.spacing);
		expect(darkTheme.radius).toEqual(lightTheme.radius);
		expect(darkTheme.typography).toEqual(lightTheme.typography);
	});
});
