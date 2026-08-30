import { act, render } from "@testing-library/react-native";
import { LogConfirmationToast } from "./log-confirmation-toast";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

describe("LogConfirmationToast", () => {
	afterEach(() => jest.useRealTimers());

	it("announces the confirmation and dismisses it after five seconds", async () => {
		jest.useFakeTimers();
		const onDismiss = jest.fn();
		const view = await render(
			<LogConfirmationToast
				message="Water added"
				actionLabel="View log"
				onDismiss={onDismiss}
				onAction={jest.fn()}
			/>,
		);

		expect(view.getByText("Water added")).toBeTruthy();
		expect(view.getByText("View log")).toBeTruthy();

		act(() => jest.advanceTimersByTime(5_000));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});
