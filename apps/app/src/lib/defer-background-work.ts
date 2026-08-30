/** Long enough for a resumed app's first navigation to get through. */
const RESUME_QUIET_MS = 1_500;

export type DeferredWork = { cancel: () => void };

/**
 * Runs upkeep a beat after the app resumes rather than on the foreground event
 * itself.
 *
 * React Native dispatches touches on the same thread this work runs on, so a
 * job started the instant the app foregrounds sits ahead of the first tab tap
 * that follows it. Nothing on screen waits for this work — the screens read
 * durable stores, not the importer — so letting the user go first costs only
 * that a refresh lands a second or so later than it could have.
 *
 * `InteractionManager` would say this better, but React Native 0.85 deprecated
 * it to a bare `setImmediate` that no longer tracks interactions at all.
 */
export function deferBackgroundWork(work: () => void): DeferredWork {
	const timer = setTimeout(work, RESUME_QUIET_MS);
	return { cancel: () => clearTimeout(timer) };
}
