import { render, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { ReminderNotificationEffects } from "./reminder-notification-effects";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
	router: { replace: (...args: unknown[]) => mockReplace(...args) },
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
});
