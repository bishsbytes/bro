import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toMessage } from "./errors";

/**
 * A screen's view of one feature-store read: what came back, what went wrong,
 * and how to ask again.
 */
export type StoreLoad<T> = {
	/**
	 * What the loader returned, or `undefined` until the first attempt settles.
	 * A loader whose own result can be `null` — a record that has since been
	 * deleted — stays distinguishable from "not yet loaded" that way, so read
	 * `loading` rather than testing this against `null`.
	 */
	data: T | undefined;
	/** The message from the last failed attempt. Cleared when another starts. */
	error: string | null;
	/** Whether to show a spinner in place of content. */
	loading: boolean;
	/** Run the loader again — a retry button, or after a mutation. */
	reload: () => Promise<void>;
	/** Replace the loaded value with one a mutation just returned. */
	setData: (value: T) => void;
	/** Report a failure from a mutation the screen ran itself. */
	setError: (message: string | null) => void;
};

type State<T> = {
	data: T | undefined;
	error: string | null;
	loading: boolean;
};

const INITIAL: State<never> = { data: undefined, error: null, loading: true };

function useLoadCore<T>(load: () => Promise<T>) {
	const [state, setState] = useState<State<T>>(INITIAL);
	// Which attempt is allowed to publish. A load in flight when another starts
	// — a focus landing mid-request, or a route param changing — would
	// otherwise overwrite the newer result when it eventually resolves.
	const attempt = useRef(0);
	const loaded = useRef<(() => Promise<T>) | null>(null);

	const run = useCallback(async () => {
		const ticket = ++attempt.current;
		// A different loader means a different subject: drop what is on screen
		// rather than show one record's data under another's heading.
		const subjectChanged = loaded.current !== load;
		loaded.current = load;
		setState((current) =>
			subjectChanged || current.data === undefined
				? { data: undefined, error: null, loading: true }
				: { ...current, error: null },
		);
		try {
			const data = await load();
			if (attempt.current === ticket) {
				setState({ data, error: null, loading: false });
			}
		} catch (caught) {
			if (attempt.current === ticket) {
				setState((current) => ({
					...current,
					error: toMessage(caught),
					loading: false,
				}));
			}
		}
	}, [load]);

	const setData = useCallback((value: T) => {
		// A mutation snapshot is newer than any read already in flight. Without
		// invalidating its ticket, a slow focus refresh can land afterwards and
		// put the pre-mutation value back on screen.
		++attempt.current;
		setState((current) => ({ ...current, data: value, loading: false }));
	}, []);

	const setError = useCallback((message: string | null) => {
		// A mutation failure is likewise authoritative. Clearing an old message is
		// not: callers do that before starting a write, whose eventual result will
		// invalidate any overlapping read through this setter or `setData`.
		if (message !== null) {
			++attempt.current;
		}
		setState((current) => ({ ...current, error: message }));
	}, []);

	return { state, run, setData, setError };
}

function result<T>(core: ReturnType<typeof useLoadCore<T>>): StoreLoad<T> {
	return {
		...core.state,
		reload: core.run,
		setData: core.setData,
		setError: core.setError,
	};
}

/**
 * Read a feature store when the screen mounts, and again whenever `load`
 * changes identity.
 *
 * Pass a `useCallback`-stabilised loader closing over the route parameters it
 * reads; changing one loads the new subject and shows a spinner while it
 * arrives. For a screen that should also pick up edits made elsewhere, use
 * {@link useFocusStoreLoad}.
 */
export function useStoreLoad<T>(load: () => Promise<T>): StoreLoad<T> {
	const core = useLoadCore(load);
	const { run } = core;
	useEffect(() => {
		void run();
	}, [run]);
	return result(core);
}

/**
 * Read a feature store every time the screen comes into focus.
 *
 * This is the default for a screen showing data another screen can change:
 * returning to it after an edit re-reads rather than showing what was true
 * when it was first opened. A refresh keeps the current content on screen
 * until the new read lands, so returning to a list does not flash a spinner.
 */
export function useFocusStoreLoad<T>(load: () => Promise<T>): StoreLoad<T> {
	const core = useLoadCore(load);
	const { run } = core;
	useFocusEffect(
		useCallback(() => {
			void run();
		}, [run]),
	);
	return result(core);
}
