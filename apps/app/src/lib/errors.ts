/**
 * The message a screen should show for a value caught from a `catch`.
 *
 * Stores reject with `Error`, so the message is normally the interesting half.
 * A caught value is `unknown` though, and JavaScript lets anything be thrown,
 * so every call site has to narrow before reading `.message`.
 *
 * `fallback` covers the non-`Error` case. It defaults to `String(caught)`,
 * which keeps a stray thrown string readable; pass translated copy instead
 * where a screen would rather show its own wording than a stringified value.
 */
export function toMessage(caught: unknown, fallback?: string): string {
	if (caught instanceof Error) {
		return caught.message;
	}
	return fallback ?? String(caught);
}
