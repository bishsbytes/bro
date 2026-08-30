import { act, render, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { AppState } from "react-native";
import { refreshReminderNotifications } from "./reminder-materialiser";
import { ReminderNotificationEffects } from "./reminder-notification-effects";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
	router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));
jest.mock("./reminder-materialiser", () => ({
	refreshReminderNotifications: jest.fn(() => Promise.resolve()),
	reportReminderRefreshFailure: jest.fn(),
}));

function notificationResponse(identifier: string) {
	return {
		actionIdentifier: "default",
		notification: {
			date: Date.now(),
			request: {
				identifier,
				content: {},
				trigger: null,
			},
		},
	};
}

describe("reminder notification response routing", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(Notifications.getLastNotificationResponse as jest.Mock).mockReturnValue(
			null,
		);
	});

	it("holds a cold-start tap behind onboarding, then opens today", async () => {
		(Notifications.getLastNotificationResponse as jest.Mock).mockReturnValue(
			notificationResponse("checkin-reminder:reminder-1:2026-08-14"),
		);
		const view = await render(
			<ReminderNotificationEffects onboardingComplete={false} />,
		);
		expect(mockReplace).not.toHaveBeenCalled();

		await view.rerender(
			<ReminderNotificationEffects onboardingComplete={true} />,
		);
		await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
		expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
	});

	it("routes a warm reminder tap but ignores unrelated notifications", async () => {
		let listener:
			| ((response: ReturnType<typeof notificationResponse>) => void)
			| null = null;
		(
			Notifications.addNotificationResponseReceivedListener as jest.Mock
		).mockImplementation((nextListener) => {
			listener = nextListener;
			return { remove: jest.fn() };
		});
		await render(<ReminderNotificationEffects onboardingComplete />);
		expect(listener).not.toBeNull();
		const emit = listener as unknown as (
			response: ReturnType<typeof notificationResponse>,
		) => void;

		emit(notificationResponse("another-domain:one"));
		expect(mockReplace).not.toHaveBeenCalled();
		emit(notificationResponse("checkin-reminder:one:2026-08-14"));
		expect(mockReplace).toHaveBeenCalledWith("/");
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

		await render(<ReminderNotificationEffects onboardingComplete />);
		await waitFor(() =>
			expect(refreshReminderNotifications).toHaveBeenCalledTimes(1),
		);
		jest.useFakeTimers();
		listener?.("active");
		listener?.("background");
		await act(async () => {
			jest.runOnlyPendingTimers();
		});

		expect(refreshReminderNotifications).toHaveBeenCalledTimes(1);
		jest.useRealTimers();
	});
});
