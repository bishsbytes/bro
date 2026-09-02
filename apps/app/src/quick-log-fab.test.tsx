import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { QuickLogFab } from "./components/quick-log-fab";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
}));

jest.mock("react-native-safe-area-context", () => ({
	...jest.requireActual("react-native-safe-area-context"),
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

describe("quick log fab", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("offers note and universal log actions without assuming smoking", async () => {
		const view = await render(
			<QuickLogFab bottom={24} isNicotineEnabled={async () => false} />,
		);

		await fireEvent.press(view.getByLabelText("Log"));

		expect(view.getByText("Note")).toBeTruthy();
		expect(view.getByText("Food")).toBeTruthy();
		expect(view.getByText("Drink")).toBeTruthy();
		expect(view.getByText("Check-in")).toBeTruthy();
		// Smoking is a minority behaviour: it is not offered unasked.
		await waitFor(() => expect(view.queryByText("Smoke or vape")).toBeNull());

		await fireEvent.press(view.getByLabelText("Note"));
		expect(router.push).toHaveBeenCalledWith("/notes/new");
	});

	it("offers the smoking action once the stream is tracked", async () => {
		const view = await render(
			<QuickLogFab bottom={24} isNicotineEnabled={async () => true} />,
		);

		await fireEvent.press(view.getByLabelText("Log"));

		const action = await view.findByText("Smoke or vape");
		expect(action).toBeTruthy();
		await fireEvent.press(view.getByLabelText("Smoke or vape"));
		expect(router.push).toHaveBeenCalledWith("/nicotine/log");
	});

	it("hides the smoking action when the tracked check fails", async () => {
		const view = await render(
			<QuickLogFab
				bottom={24}
				isNicotineEnabled={async () => {
					throw new Error("database unavailable");
				}}
			/>,
		);

		await fireEvent.press(view.getByLabelText("Log"));

		// A failed read must not surface a smoking button to someone who never
		// asked for one; the other three actions still work.
		await waitFor(() => expect(view.queryByText("Smoke or vape")).toBeNull());
		expect(view.getByText("Check-in")).toBeTruthy();
	});
});
