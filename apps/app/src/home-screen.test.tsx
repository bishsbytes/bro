import { render } from "@testing-library/react-native";
import { HomeScreen } from "./screens/home-screen";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
}));

describe("home screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("keeps account management behind an in-app entry point", async () => {
		const screen = await render(<HomeScreen />);

		expect(screen.getByText("Local database ready")).toBeTruthy();
		expect(screen.getByText("Account")).toBeTruthy();
	});
});
