/**
 * A wheel score as a bare numeral. Scores are whole numbers when a person
 * types them, but a rescaled observation can land between two points, so the
 * screens that show one share this rounding rather than each picking its own.
 */
export function formatScore(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
