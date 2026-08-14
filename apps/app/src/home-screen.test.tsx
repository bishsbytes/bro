import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { listFactors } from "./content/metric-registry";
import { HomeScreen } from "./screens/home-screen";

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

	it("shows the fast check-in", async () => {
		const screen = await render(
			<HomeScreen
				store={{
					loadToday: jest.fn(async () => emptyToday),
					save: jest.fn(async () => emptyToday),
				}}
			/>,
		);

		expect(await screen.findByLabelText("Mood 4")).toBeTruthy();
	});

	it("saves after mood, energy, and one factor selection", async () => {
		const save = jest.fn(async () => emptyToday);
		const screen = await render(
			<HomeScreen
				store={{ loadToday: jest.fn(async () => emptyToday), save }}
			/>,
		);
		await screen.findByLabelText("Mood 4");

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
	});
});
