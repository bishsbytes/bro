import { render, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";
import { HealthImportEffects } from "./health-import-effects";
import { healthImportEngine } from "./import-service";

jest.mock("./import-service", () => ({
	healthImportEngine: { refresh: jest.fn(() => Promise.resolve()) },
}));

describe("health import lifecycle effects", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("refreshes on launch and whenever the app enters the foreground", async () => {
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
		await waitFor(() =>
			expect(healthImportEngine.refresh).toHaveBeenCalledTimes(1),
		);

		listener?.("background");
		expect(healthImportEngine.refresh).toHaveBeenCalledTimes(1);
		listener?.("active");
		await waitFor(() =>
			expect(healthImportEngine.refresh).toHaveBeenCalledTimes(2),
		);

		await view.unmount();
		expect(remove).toHaveBeenCalledTimes(1);
	});
});
