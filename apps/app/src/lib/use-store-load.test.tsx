import { act, type RenderResult, render } from "@testing-library/react-native";
import { useCallback } from "react";
import { Text } from "react-native";
import { useStoreLoad } from "./use-store-load";

// The focus variant differs only in what re-runs the loader, which belongs to
// expo-router; these cover the state machine both variants share.
function Probe({ load }: { load: () => Promise<string | null> }) {
	const { data, error, loading, reload, setData, setError } =
		useStoreLoad(load);
	return (
		<>
			<Text testID="state">
				{loading
					? "loading"
					: error
						? `error:${error}`
						: `data:${String(data)}`}
			</Text>
			<Text testID="reload" onPress={() => void reload()}>
				reload
			</Text>
			<Text testID="set-data" onPress={() => setData("written")}>
				set data
			</Text>
			<Text testID="set-error" onPress={() => setError("write failed")}>
				set error
			</Text>
		</>
	);
}

function deferred<T>() {
	let settle!: (value: T) => void;
	let fail!: (reason: unknown) => void;
	const promise = new Promise<T>((resolve, reject) => {
		settle = resolve;
		fail = reject;
	});
	return { promise, settle, fail };
}

function state(view: RenderResult): string {
	return view.getByTestId("state").props.children;
}

async function press(view: RenderResult) {
	await act(async () => {
		view.getByTestId("reload").props.onPress();
	});
}

describe("useStoreLoad", () => {
	it("holds the spinner until the first read settles", async () => {
		const first = deferred<string>();
		const view = await render(<Probe load={() => first.promise} />);

		expect(state(view)).toBe("loading");

		await act(async () => {
			first.settle("value");
		});

		expect(state(view)).toBe("data:value");
	});

	it("reports a rejection as a message rather than staying blank", async () => {
		const failing = deferred<string>();
		const view = await render(<Probe load={() => failing.promise} />);

		await act(async () => {
			failing.fail(new Error("database is closed"));
		});

		expect(state(view)).toBe("error:database is closed");
	});

	it("keeps null distinct from not-yet-loaded", async () => {
		const gone = deferred<string | null>();
		const view = await render(<Probe load={() => gone.promise} />);

		await act(async () => {
			gone.settle(null);
		});

		// A record that has since been deleted has finished loading; the screen
		// needs to reach its "not found" branch rather than spin forever.
		expect(state(view)).toBe("data:null");
	});

	it("shows the spinner again while retrying a read that never succeeded", async () => {
		const attempts = [deferred<string>(), deferred<string>()];
		let attempt = 0;
		const view = await render(
			<Probe load={() => attempts[attempt++].promise} />,
		);

		await act(async () => {
			attempts[0].fail(new Error("no connection"));
		});
		expect(state(view)).toBe("error:no connection");

		await press(view);
		expect(state(view)).toBe("loading");

		await act(async () => {
			attempts[1].settle("second try");
		});
		expect(state(view)).toBe("data:second try");
	});

	it("keeps the current content on screen while refreshing it", async () => {
		const attempts = [deferred<string>(), deferred<string>()];
		let attempt = 0;
		const view = await render(
			<Probe load={() => attempts[attempt++].promise} />,
		);

		await act(async () => {
			attempts[0].settle("first");
		});

		await press(view);
		// Returning to a list must not flash a spinner over what it already shows.
		expect(state(view)).toBe("data:first");

		await act(async () => {
			attempts[1].settle("second");
		});
		expect(state(view)).toBe("data:second");
	});

	it("ignores a superseded read that resolves after a newer one", async () => {
		const slow = deferred<string>();
		const quick = deferred<string>();
		const attempts = [slow, quick];
		let attempt = 0;
		const view = await render(
			<Probe load={() => attempts[attempt++].promise} />,
		);

		await press(view);
		await act(async () => {
			quick.settle("newer");
		});
		expect(state(view)).toBe("data:newer");

		await act(async () => {
			slow.settle("stale");
		});

		expect(state(view)).toBe("data:newer");
	});

	it("does not let an in-flight refresh overwrite a mutation snapshot", async () => {
		const attempts = [deferred<string>(), deferred<string>()];
		let attempt = 0;
		const view = await render(
			<Probe load={() => attempts[attempt++].promise} />,
		);

		await act(async () => {
			attempts[0].settle("before write");
		});
		await press(view);
		await act(async () => {
			view.getByTestId("set-data").props.onPress();
			attempts[1].settle("stale refresh");
		});

		expect(state(view)).toBe("data:written");
	});

	it("does not let an in-flight refresh clear a mutation failure", async () => {
		const attempts = [deferred<string>(), deferred<string>()];
		let attempt = 0;
		const view = await render(
			<Probe load={() => attempts[attempt++].promise} />,
		);

		await act(async () => {
			attempts[0].settle("before write");
		});
		await press(view);
		await act(async () => {
			view.getByTestId("set-error").props.onPress();
			attempts[1].settle("stale refresh");
		});

		expect(state(view)).toBe("error:write failed");
	});

	it("drops the previous subject's data when the loader changes", async () => {
		const one = deferred<string>();
		const two = deferred<string>();

		function Keyed({ id }: { id: string }) {
			return (
				<Probe
					load={useCallback(() => (id === "1" ? one : two).promise, [id])}
				/>
			);
		}

		const view = await render(<Keyed id="1" />);
		await act(async () => {
			one.settle("first record");
		});
		expect(state(view)).toBe("data:first record");

		await act(async () => {
			view.rerender(<Keyed id="2" />);
		});

		// Showing one record's data under another's heading is worse than a spinner.
		expect(state(view)).toBe("loading");

		await act(async () => {
			two.settle("second record");
		});
		expect(state(view)).toBe("data:second record");
	});
});
