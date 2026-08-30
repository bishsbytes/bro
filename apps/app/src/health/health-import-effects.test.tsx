import { act, render } from "@testing-library/react-native";
import { AppState } from "react-native";
import { HealthImportEffects } from "./health-import-effects";
import { healthImportEngine } from "./import-service";

jest.mock("./import-service", () => ({
	healthImportEngine: { refresh: jest.fn(() => Promise.resolve()) },
}));

/** Lets the delay the effects schedule their refresh behind elapse. */
async function settle() {
	await act(async () => {
		jest.runOnlyPendingTimers();
	});
}

describe("health import lifecycle effects", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("refreshes once the app has settled, on launch and on every foreground", async () => {
		let listener: ((state: string) => void) | undefined;
		const remove = jest.fn();
		jest.spyOn(AppState, "addEventListener").mockImplementation(((
			_event,
			nextListener,
		) => {
			listener = nextListener as (state: string) => void;
			return { remove };
		}) as typeof AppState.addEventListener);

		const view = await render(<HealthImportEffects />);
		// The import waits rather than competing with the user's first tap.
		expect(healthImportEngine.refresh).not.toHaveBeenCalled();
		await settle();
		expect(healthImportEngine.refresh).toHaveBeenCalledTimes(1);

		listener?.("background");
		await settle();
		expect(healthImportEngine.refresh).toHaveBeenCalledTimes(1);

		listener?.("active");
		expect(healthImportEngine.refresh).toHaveBeenCalledTimes(1);
		await settle();
		expect(healthImportEngine.refresh).toHaveBeenCalledTimes(2);

		await view.unmount();
		expect(remove).toHaveBeenCalledTimes(1);
	});

	it("drops a scheduled refresh when the app is torn down before it runs", async () => {
		const view = await render(<HealthImportEffects />);
		await view.unmount();
		await settle();

		expect(healthImportEngine.refresh).not.toHaveBeenCalled();
	});

	it("drops a scheduled refresh when the app leaves the foreground", async () => {
		let listener: ((state: string) => void) | undefined;
		jest.spyOn(AppState, "addEventListener").mockImplementation(((
			_event,
			nextListener,
		) => {
			listener = nextListener as (state: string) => void;
			return { remove: jest.fn() };
		}) as typeof AppState.addEventListener);

		await render(<HealthImportEffects />);
		listener?.("background");
		await settle();

		expect(healthImportEngine.refresh).not.toHaveBeenCalled();
	});
});
