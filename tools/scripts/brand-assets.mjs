/**
 * Regenerates the Expo raster assets from the brand SVGs, and checks that the
 * marks sit where the platforms require.
 *
 *   node tools/scripts/brand-assets.mjs            rebuild apps/app/assets/images/*
 *   node tools/scripts/brand-assets.mjs --check    verify geometry + freshness, exit 1 on failure
 *
 * Expo derives every native icon (iOS appiconset, Android mipmaps, splash
 * drawables) from the six files this writes, so re-run `expo prebuild` after a
 * rebuild to push changes into apps/app/ios and apps/app/android.
 *
 * Requires rsvg-convert (librsvg) and magick (ImageMagick 7) on PATH.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const BRAND = join(ROOT, "design/brand");
const OUT = join(ROOT, "apps/app/assets/images");

const CANVAS = 1024;

/**
 * Android adaptive icons are a 108dp layer. Launchers mask it to the middle
 * 72dp, and only the middle 66dp is guaranteed visible whatever mask shape the
 * launcher picks, so all ink must stay inside that 66dp circle.
 */
const ADAPTIVE_MASK_RADIUS = (CANVAS * (72 / 108)) / 2;
const ADAPTIVE_SAFE_RADIUS = (CANVAS * (66 / 108)) / 2;

/** Radius of the circle bro-glyph.svg draws for itself. */
const GLYPH_CIRCLE_RADIUS = 512;

/** Rasterised outputs. `opaque` files are flattened to RGB with no alpha channel. */
const ASSETS = [
	{ out: "icon.png", svg: "bro-icon-light.svg", size: 1024, opaque: true },
	{
		out: "splash-icon.png",
		svg: "bro-icon-light.svg",
		size: 1024,
		opaque: true,
	},
	{
		out: "splash-icon-dark.png",
		svg: "bro-icon-dark.svg",
		size: 1024,
		opaque: true,
	},
	{
		out: "adaptive-icon.png",
		svg: "bro-icon-android-foreground.svg",
		size: 1024,
		opaque: false,
	},
	{
		out: "monochrome-icon.png",
		svg: "bro-icon-android-monochrome.svg",
		size: 1024,
		opaque: false,
	},
	{ out: "favicon.png", svg: "bro-glyph.svg", size: 48, opaque: false },
];

/**
 * Where each mark has to land. `maxCorner` is the furthest any corner of the
 * mark's ink box may sit from the canvas centre, and `clipCorner` the point past
 * which the launcher mask cuts the ink off outright; `widthRatio` and
 * `cornerRatio` are inclusive [min, max] bands.
 */
const GEOMETRY = [
	{
		svg: "bro-icon-android-foreground.svg",
		label: "Android adaptive foreground",
		maxCorner: ADAPTIVE_SAFE_RADIUS,
		clipCorner: ADAPTIVE_MASK_RADIUS,
		reason: "must stay inside Android's 66dp safe zone or launchers clip it",
	},
	{
		svg: "bro-icon-android-monochrome.svg",
		label: "Android monochrome (themed) layer",
		maxCorner: ADAPTIVE_SAFE_RADIUS,
		clipCorner: ADAPTIVE_MASK_RADIUS,
		reason: "must stay inside Android's 66dp safe zone or launchers clip it",
	},
	{
		svg: "bro-icon-light.svg",
		label: "App icon (light)",
		widthRatio: [0.82, 0.84],
		reason: "brand rule: the mark occupies 83% of the icon canvas width",
	},
	{
		svg: "bro-icon-dark.svg",
		label: "App icon (dark)",
		widthRatio: [0.82, 0.84],
		reason: "brand rule: the mark occupies 83% of the icon canvas width",
	},
	{
		svg: "bro-icon-tinted.svg",
		label: "App icon (tinted)",
		widthRatio: [0.82, 0.84],
		reason: "brand rule: the mark occupies 83% of the icon canvas width",
	},
	{
		svg: "bro-glyph.svg",
		label: "Notification glyph",
		cornerRatio: [0.85, 0.89],
		circleRadius: GLYPH_CIRCLE_RADIUS,
		reason: "sized to match the themed icon's 87% fill of its circle",
	},
];

/** Ink must be centred on the canvas to within this many pixels. */
const CENTRE_TOLERANCE = 1;

let tmp;
function scratch() {
	if (!tmp) tmp = mkdtempSync(join(tmpdir(), "brand-assets-"));
	return tmp;
}

function render(svgPath, size, outPath) {
	execFileSync("rsvg-convert", [
		"-w",
		String(size),
		"-h",
		String(size),
		svgPath,
		"-o",
		outPath,
	]);
}

/**
 * ImageMagick stamps tIME and date:* chunks into PNGs by default, which would
 * make every rebuild produce different bytes for identical pixels — a spurious
 * git diff, and a freshness check that can never pass. Excluding them makes the
 * output reproducible.
 */
function flatten(inPath, outPath) {
	execFileSync("magick", [
		inPath,
		"-background",
		"none",
		"-flatten",
		"-alpha",
		"off",
		"-define",
		"png:exclude-chunks=date,time",
		`PNG24:${outPath}`,
	]);
}

function build({ svg, size, opaque }, outPath) {
	const src = join(BRAND, svg);
	if (!opaque) {
		render(src, size, outPath);
		return;
	}
	const raw = join(scratch(), `raw-${basename(outPath)}`);
	render(src, size, raw);
	flatten(raw, outPath);
}

/**
 * Bounding box of the drawn mark, in canvas pixels. The background layer is
 * tagged id="bg" in the SVG and dropped first, so what is measured is the mark
 * itself rather than the plate it sits on. Measuring the render (rather than
 * doing arithmetic on the transform) means a change to the paths is caught too,
 * not just a change to the scale.
 */
function measureInk(svg) {
	const source = readFileSync(join(BRAND, svg), "utf8");
	const stripped = source.replace(
		/^\s*<(?:rect|circle)\b[^>]*\bid="bg"[^>]*\/>\s*$/gm,
		"",
	);
	const isolated = join(scratch(), `ink-${svg}`);
	const png = `${isolated}.png`;
	writeFileSync(isolated, stripped);
	render(isolated, CANVAS, png);
	const out = execFileSync("magick", [
		png,
		"-trim",
		"-format",
		"%w %h %X %Y",
		"info:",
	]).toString();
	const [w, h, x, y] = out
		.trim()
		.split(/\s+/)
		.map((n) => Number.parseInt(n, 10));
	return { w, h, x, y, cx: x + w / 2, cy: y + h / 2 };
}

/** Furthest distance from the canvas centre to any corner of the ink box. */
function worstCorner(ink) {
	const c = CANVAS / 2;
	return Math.max(
		...[
			[ink.x, ink.y],
			[ink.x + ink.w, ink.y],
			[ink.x, ink.y + ink.h],
			[ink.x + ink.w, ink.y + ink.h],
		].map(([x, y]) => Math.hypot(x - c, y - c)),
	);
}

function checkGeometry() {
	const failures = [];
	for (const rule of GEOMETRY) {
		const ink = measureInk(rule.svg);
		const corner = worstCorner(ink);
		const offX = ink.cx - CANVAS / 2;
		const offY = ink.cy - CANVAS / 2;
		const problems = [];

		if (
			Math.abs(offX) > CENTRE_TOLERANCE ||
			Math.abs(offY) > CENTRE_TOLERANCE
		) {
			problems.push(`off-centre by (${offX.toFixed(1)}, ${offY.toFixed(1)})px`);
		}
		if (rule.maxCorner !== undefined && corner > rule.maxCorner) {
			const clipped = rule.clipCorner !== undefined && corner > rule.clipCorner;
			problems.push(
				clipped
					? `ink reaches ${corner.toFixed(0)}px from centre and is cut off by the launcher mask at ${rule.clipCorner.toFixed(0)}px`
					: `ink reaches ${corner.toFixed(0)}px from centre, past the ${rule.maxCorner.toFixed(0)}px safe zone`,
			);
		}
		if (rule.widthRatio) {
			const ratio = ink.w / CANVAS;
			const [lo, hi] = rule.widthRatio;
			if (ratio < lo || ratio > hi) {
				problems.push(
					`mark is ${(ratio * 100).toFixed(1)}% of canvas width, expected ${lo * 100}–${hi * 100}%`,
				);
			}
		}
		if (rule.cornerRatio) {
			const ratio = corner / rule.circleRadius;
			const [lo, hi] = rule.cornerRatio;
			if (ratio < lo || ratio > hi) {
				problems.push(
					`mark fills ${(ratio * 100).toFixed(0)}% of its circle, expected ${lo * 100}–${hi * 100}%`,
				);
			}
		}

		if (problems.length > 0) {
			failures.push(
				`${rule.label} (${rule.svg})\n    ${problems.join("\n    ")}\n    ${rule.reason}`,
			);
		} else {
			console.log(
				`  ok  ${rule.label} — ${ink.w}x${ink.h}, corner ${corner.toFixed(0)}px, centred`,
			);
		}
	}
	return failures;
}

function checkFreshness() {
	const failures = [];
	for (const asset of ASSETS) {
		const expected = join(scratch(), `fresh-${asset.out}`);
		build(asset, expected);
		const committed = join(OUT, asset.out);
		if (readFileSync(expected).equals(readFileSync(committed))) {
			console.log(`  ok  ${asset.out} matches ${asset.svg}`);
		} else {
			failures.push(
				`${asset.out} is out of date with ${asset.svg}\n    run: pnpm brand` +
					"\n    (a librsvg/ImageMagick version change can also cause this)",
			);
		}
	}
	return failures;
}

function main() {
	const check = process.argv.includes("--check");
	try {
		if (!check) {
			for (const asset of ASSETS) {
				build(asset, join(OUT, asset.out));
				console.log(
					`wrote apps/app/assets/images/${asset.out}  <- ${asset.svg}`,
				);
			}
			console.log(
				"\nRun `pnpm nx run app:prebuild` (or npx expo prebuild) to update the native icons.",
			);
			return;
		}

		console.log("Geometry:");
		const geometry = checkGeometry();
		console.log("\nFreshness:");
		const freshness = checkFreshness();
		const failures = [...geometry, ...freshness];

		if (failures.length > 0) {
			console.error(`\n${failures.length} problem(s):\n`);
			for (const f of failures) console.error(`  - ${f}\n`);
			process.exit(1);
		}
		console.log("\nAll brand assets are in spec and up to date.");
	} finally {
		if (tmp) rmSync(tmp, { recursive: true, force: true });
	}
}

main();
