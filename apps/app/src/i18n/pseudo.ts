/**
 * Builds a fake locale out of the English catalogues so untranslated copy is
 * visible without waiting for a real translation. Three faults show up at a
 * glance on a pseudo-localised build:
 *
 * - Copy that renders in plain ASCII never went through a catalogue.
 * - Copy clipped by its container will not survive a language that runs longer
 *   than English, which most of them do.
 * - Copy that runs past a bracket, or shows brackets mid-sentence, was
 *   assembled from fragments and will not reorder for another grammar.
 */

const PLAIN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ACCENTED = "áƀçðéƒǵĥíĵķĺḿńóṕɋŕśťúṽŵẋýźÁƁÇÐÉƑǴĤÍĴĶĹḾŃÓṔɊŔŚŤÚṼŴẊÝŹ";

/** How much longer than English a translation is assumed to run. */
const EXPANSION = 0.35;

/** Interpolation spans, which must reach i18next unchanged to still resolve. */
const PLACEHOLDER = /(\{\{[^}]*\}\})/g;

function accent(text: string): string {
	let out = "";
	for (const character of text) {
		const index = PLAIN.indexOf(character);
		out += index === -1 ? character : (ACCENTED[index] ?? character);
	}
	return out;
}

function pad(length: number): string {
	return "·".repeat(Math.ceil(length * EXPANSION));
}

export function pseudoLocaliseString(value: string): string {
	const accented = value
		.split(PLACEHOLDER)
		.map((part, index) => (index % 2 === 1 ? part : accent(part)))
		.join("");

	// Pad from the visible text only: widening the placeholders would misreport
	// how much room the interpolated value itself needs.
	const visible = value.replaceAll(PLACEHOLDER, "");
	return `⟦${accented}${pad(visible.length)}⟧`;
}

type Catalogue = { [key: string]: string | Catalogue };

/** Rebuilds a catalogue tree with every leaf string pseudo-localised. */
export function pseudoLocalise<T extends Catalogue>(catalogue: T): T {
	const out: Catalogue = {};
	for (const [key, value] of Object.entries(catalogue)) {
		out[key] =
			typeof value === "string"
				? pseudoLocaliseString(value)
				: pseudoLocalise(value);
	}
	return out as T;
}
