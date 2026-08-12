import { AuthProvider, authClient } from "@bro/auth-app";
import { act, fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import { HomeScreen } from "./screens/home-screen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	router: { push: mockPush, replace: jest.fn() },
}));

jest.mock("../../../packages/auth/app/src/client", () => ({
	assertRemoteAuthConfigured: jest.fn(),
	authClient: {
		useSession: jest.fn(),
		signIn: { email: jest.fn() },
		signUp: { email: jest.fn() },
		signOut: jest.fn(),
	},
}));

const mockedAuthClient = authClient as unknown as {
	useSession: jest.Mock;
	signOut: jest.Mock;
};

/**
 * Wires the session marker to state the way the real device-settings provider
 * does, so signing out genuinely flips it mid-render.
 */
function Harness() {
	const [hasStoredRemoteSession, setMarker] = useState(true);

	return (
		<AuthProvider
			hasStoredRemoteSession={hasStoredRemoteSession}
			onRemoteSessionStored={async () => setMarker(true)}
			onRemoteSessionCleared={async () => setMarker(false)}
		>
			<HomeScreen />
		</AuthProvider>
	);
}

describe("home screen sign-out", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedAuthClient.useSession.mockReturnValue({
			data: {
				user: { id: "user-a", name: "Ada", email: "ada@example.com" },
				session: { id: "session-a" },
			},
			isPending: false,
			error: null,
		});
	});

	it("tells the user revocation did not reach the server, and stays usable", async () => {
		mockedAuthClient.signOut.mockResolvedValue({
			data: null,
			error: { message: "Network request failed" },
		});

		const screen = await render(<Harness />);
		await act(async () => {
			fireEvent.press(screen.getByText("Sign out"));
		});

		// The notice is set after the marker flips, so it only survives if the
		// screen is not remounted by that flip.
		expect(
			await screen.findByText(
				"Signed out on this device. The server could not be reached.",
			),
		).toBeTruthy();
		// Signing out leaves the user in the app, not at a sign-in requirement.
		expect(screen.getByText("Using bro without an account")).toBeTruthy();
		expect(screen.getByText("Sign in")).toBeTruthy();
	});

	it("confirms a clean sign-out when the server was reached", async () => {
		mockedAuthClient.signOut.mockResolvedValue({ data: {}, error: null });

		const screen = await render(<Harness />);
		await act(async () => {
			fireEvent.press(screen.getByText("Sign out"));
		});

		expect(await screen.findByText("Signed out on this device.")).toBeTruthy();
	});
});
