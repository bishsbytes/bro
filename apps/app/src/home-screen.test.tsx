import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { listFactors } from "./content/metric-registry";
import { HomeScreen } from "./screens/home-screen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	router: { push: mockPush },
}));

const emptyToday = {
	localDay: "2026-08-14",
	entries: [],
	selectedFactorSlugs: [],
	availableFactors: listFactors(),
	note: "",
};

describe("home screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("shows the fast check-in and keeps every app destination reachable", async () => {
		const screen = await render(
			<HomeScreen
				store={{
					loadToday: jest.fn(async () => emptyToday),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		expect(await screen.findByText("How are you?")).toBeTruthy();
		expect(screen.getByText("Account")).toBeTruthy();
		expect(screen.getByText("History")).toBeTruthy();
		expect(screen.getByText("Trends")).toBeTruthy();
		expect(screen.getByText("Settings")).toBeTruthy();
	});

	it("saves after mood, energy, and one factor selection", async () => {
		const save = jest.fn(async () => emptyToday);
		const screen = await render(
			<HomeScreen
				store={{ loadToday: jest.fn(async () => emptyToday), save }}
			/>,
		);
		await screen.findByText("How are you?");

		await fireEvent.press(screen.getByLabelText("Mood 4"));
		await fireEvent.press(screen.getByLabelText("Energy 3"));
		await fireEvent.press(screen.getByLabelText("Alcohol"));
		await fireEvent.press(screen.getByText("Save check-in"));

		await waitFor(() =>
			expect(save).toHaveBeenCalledWith(
				{
					mood: 4,
					energy: 3,
					selectedFactorSlugs: ["alcohol"],
					note: "",
				},
				null,
			),
		);
		expect(mockPush).not.toHaveBeenCalled();
	});
});
