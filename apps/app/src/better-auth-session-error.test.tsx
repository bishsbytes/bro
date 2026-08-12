import { render, waitFor } from "@testing-library/react-native";
import { createAuthClient } from "better-auth/react";
import { useEffect } from "react";

/**
 * Two application rules read this hook's error, and both are wrong if its shape
 * changes: the stored-session marker is cleared only on a resolved absence or
 * an explicit 401, and Account shows its recoverable "temporarily unavailable"
 * state on anything else. Neither survives an error without a `status`, or a
 * failure that never settles.
 */
type ObservedSession = {
	data: unknown;
	isPending: boolean;
	error: { status?: number; message: string } | null;
};

async function settledSessionState(
	customFetchImpl: typeof fetch,
): Promise<ObservedSession> {
	const client = createAuthClient({
		baseURL: "http://example.test",
		fetchOptions: { customFetchImpl },
	});
	let latest: ObservedSession = { data: null, isPending: true, error: null };

	function Probe() {
		const state = client.useSession();

		useEffect(() => {
			latest = {
				data: state.data,
				isPending: state.isPending,
				error: state.error && {
					status: (state.error as { status?: number }).status,
					message: state.error.message,
				},
			};
		}, [state]);

		return null;
	}

	await render(<Probe />);
	await waitFor(() => expect(latest.isPending).toBe(false));

	return latest;
}

function answerWith(body: string, status: number) {
	return async () =>
		new Response(body, {
			status,
			headers: { "content-type": "application/json" },
		});
}

describe("better-auth session state contract", () => {
	it("reports an expired session as a 401, which is what clears the marker", async () => {
		const state = await settledSessionState(
			answerWith(JSON.stringify({ message: "Unauthorized" }), 401),
		);

		expect(state.data).toBeNull();
		expect(state.error?.status).toBe(401);
	});

	it("reports a resolved absence of a session with no error at all", async () => {
		const state = await settledSessionState(answerWith("null", 200));

		expect(state.data).toBeNull();
		expect(state.error).toBeNull();
	});

	it("keeps a server error distinguishable from a rejected session", async () => {
		const state = await settledSessionState(
			answerWith(JSON.stringify({ message: "boom" }), 500),
		);

		expect(state.error?.status).toBe(500);
	});

	it("settles an unreachable server into an error carrying no status", async () => {
		// Offline startup: it must resolve rather than hang, so Account can offer
		// retry instead of spinning, and it must not look like a 401, or the
		// device would forget a session that is still valid.
		const state = await settledSessionState(async () => {
			throw new Error("Network request failed");
		});

		expect(state.isPending).toBe(false);
		expect(state.error).not.toBeNull();
		expect(state.error?.status).toBeUndefined();
	});
});
