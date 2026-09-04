import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { useMemo } from "react";
import { Button, StyleSheet as NativeStyleSheet, Text } from "react-native";
import {
	BodyLogSurfaceProvider,
	useRegisterBodyLogSurface,
} from "./body/body-log-surface-context";
import { QuickLogFab } from "./components/quick-log-fab";
import { lightTheme } from "./theme/unistyles";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
}));

jest.mock("react-native-safe-area-context", () => ({
	...jest.requireActual("react-native-safe-area-context"),
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

function RegisteredBodyLog() {
	const surface = useMemo(
		() => ({
			closeAccessibilityLabel: "Close body log",
			render: ({ backToQuickLog }: { backToQuickLog: () => void }) => (
				<>
					<Text>Body log options</Text>
					<Button title="Back to log menu" onPress={backToQuickLog} />
				</>
			),
		}),
		[],
	);
	useRegisterBodyLogSurface(surface);
	return null;
}

describe("quick log fab", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("offers note and universal log actions without assuming smoking", async () => {
		const view = await render(
			<QuickLogFab bottom={24} enabledKinds={async () => ["food", "drink"]} />,
		);

		await fireEvent.press(view.getByLabelText("Log"));

		expect(view.getByText("Note")).toBeTruthy();
		expect(view.getByText("Food")).toBeTruthy();
		expect(view.getByText("Drink")).toBeTruthy();
		expect(view.getByText("Body")).toBeTruthy();
		expect(view.getByText("Check-in")).toBeTruthy();
		// Smoking is a minority behaviour: it is not offered unasked.
		await waitFor(() => expect(view.queryByText("Smoke or vape")).toBeNull());

		await fireEvent.press(view.getByLabelText("Note"));
		expect(router.push).toHaveBeenCalledWith("/notes/new");
	});

	it("uses the Helm primary-action treatment while floating", async () => {
		const view = await render(
			<QuickLogFab bottom={96} enabledKinds={async () => ["food", "drink"]} />,
		);

		expect(
			NativeStyleSheet.flatten(view.getByLabelText("Log").props.style),
		).toMatchObject({
			position: "absolute",
			right: 16,
			bottom: 96,
			width: 56,
			height: 56,
			borderRadius: 14,
			backgroundColor: lightTheme.colors.accent,
		});
		expect(
			view.getByTestId("quick-log-icon").props.children.props,
		).toMatchObject({
			color: lightTheme.colors.onAccent,
			size: 24,
		});
	});

	it("presets the one log screen to the kind chosen", async () => {
		const view = await render(
			<QuickLogFab bottom={24} enabledKinds={async () => ["food", "drink"]} />,
		);

		await fireEvent.press(view.getByLabelText("Log"));
		await fireEvent.press(view.getByLabelText("Drink"));
		expect(router.push).toHaveBeenCalledWith("/intake/log?kind=drink");
	});

	it("offers each optional stream only once it is switched on", async () => {
		const view = await render(
			<QuickLogFab
				bottom={24}
				enabledKinds={async () => ["food", "drink", "nicotine", "supplement"]}
			/>,
		);

		await fireEvent.press(view.getByLabelText("Log"));
		expect(await view.findByText("Smoke or vape")).toBeTruthy();
		expect(view.getByText("Supplement")).toBeTruthy();
		expect(view.queryByText("Medication")).toBeNull();

		await fireEvent.press(view.getByLabelText("Smoke or vape"));
		expect(router.push).toHaveBeenCalledWith("/intake/log?kind=nicotine");
	});

	it("uses the open quick-log sheet for Body sub-navigation", async () => {
		const view = await render(
			<BodyLogSurfaceProvider>
				<QuickLogFab
					bottom={24}
					bodyActive
					enabledKinds={async () => ["food", "drink"]}
				/>
				<RegisteredBodyLog />
			</BodyLogSurfaceProvider>,
		);

		await fireEvent.press(view.getByLabelText("Log"));
		const sheetBackdrop = view.getByTestId("modal-sheet-backdrop");
		await fireEvent.press(view.getByLabelText("Body"));

		expect(view.getByText("Body log options")).toBeTruthy();
		expect(view.queryByText("What would you like to log?")).toBeNull();
		expect(view.getByTestId("modal-sheet-backdrop")).toBe(sheetBackdrop);
		expect(router.push).not.toHaveBeenCalled();

		await fireEvent.press(view.getByText("Back to log menu"));
		expect(view.getByText("What would you like to log?")).toBeTruthy();
		expect(view.getByTestId("modal-sheet-backdrop")).toBe(sheetBackdrop);
	});

	it("moves to Body before opening its log from another tab", async () => {
		const view = await render(
			<BodyLogSurfaceProvider>
				<QuickLogFab bottom={24} enabledKinds={async () => ["food", "drink"]} />
				<RegisteredBodyLog />
			</BodyLogSurfaceProvider>,
		);

		await fireEvent.press(view.getByLabelText("Log"));
		await fireEvent.press(view.getByLabelText("Body"));

		expect(router.push).toHaveBeenCalledWith("/body");
		expect(view.getByText("Body log options")).toBeTruthy();
	});

	it("hides the smoking action when the tracked check fails", async () => {
		const view = await render(
			<QuickLogFab
				bottom={24}
				enabledKinds={async () => {
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
