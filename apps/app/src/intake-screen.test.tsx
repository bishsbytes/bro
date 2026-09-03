import { fireEvent, render } from "@testing-library/react-native";
import type { IntakeDaySnapshot } from "./intake/intake-store";
import { IntakeScreen } from "./screens/intake/intake-screen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	router: { push: (...args: unknown[]) => mockPush(...args) },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

jest.mock("react-native-safe-area-context", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		SafeAreaView: ({
			edges = [],
			...props
		}: {
			edges?: readonly string[];
			children?: React.ReactNode;
		}) =>
			React.createElement(View, {
				...props,
				testID: `safe-area-${edges.join("-")}`,
			}),
		useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
	};
});

function total(slug: string, label: string, dayFormatted: string | null) {
	return { metric: { slug, label }, tracked: true, dayFormatted };
}

function snapshot(
	overrides: Partial<IntakeDaySnapshot> = {},
): IntakeDaySnapshot {
	return {
		localDay: "2026-09-02",
		defaultTime: "12:00",
		enabledKinds: ["food", "drink"],
		events: [],
		metrics: [],
		totals: [],
		recents: [],
		recentLocalDays: [],
		...overrides,
	} as IntakeDaySnapshot;
}

function store(day: IntakeDaySnapshot) {
	return {
		loadToday: jest.fn(async () => day),
		repeatEvent: jest.fn(async () => ({
			id: "event-2",
			localDay: day.localDay,
		})),
	} as unknown as Pick<
		import("./intake/intake-store").IntakeStore,
		"loadToday" | "repeatEvent"
	>;
}

describe("Intake screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("states the day's tracked totals once, energy first, and lists the events", async () => {
		const screen = await render(
			<IntakeScreen
				store={store(
					snapshot({
						totals: [
							total("energy_intake", "Energy intake", "2,100 kcal"),
							total("protein_intake", "Protein", "82.0 g"),
							total("caffeine_intake", "Caffeine", null),
						] as IntakeDaySnapshot["totals"],
						events: [
							{
								event: {
									id: "event-1",
									kind: "drink",
									name: "Filter coffee",
								},
								detail: "1 × 250 ml mug · 07:40",
								contributions: "95 mg",
							},
							{
								event: { id: "event-2", kind: "food", name: "Lunch" },
								detail: "1 × portion · 13:00",
								contributions: "650 kcal · 40.0 g",
							},
						] as IntakeDaySnapshot["events"],
					}),
				)}
			/>,
		);

		expect(await screen.findByText("2,100 kcal")).toBeTruthy();
		expect(screen.getByText("82.0 g")).toBeTruthy();
		// A tracked total with nothing logged reads as a dash, never a zero or a grade.
		expect(screen.getAllByText("—").length).toBeGreaterThan(0);
		expect(screen.getByText("Filter coffee")).toBeTruthy();
		expect(screen.getByText("Lunch")).toBeTruthy();
		expect(screen.getByText("650 kcal · 40.0 g")).toBeTruthy();
		// Totals are stated, never graded: nothing counts down or judges.
		expect(
			screen.queryByText(/remaining|left today|\bover\b|\bunder\b/i),
		).toBeNull();

		await fireEvent.press(screen.getByLabelText("Edit Lunch"));
		expect(mockPush).toHaveBeenLastCalledWith("/intake/2026-09-02");
		await fireEvent.press(screen.getByText("Log something"));
		expect(mockPush).toHaveBeenLastCalledWith("/intake/log");
	});

	it("says how to get totals when nothing is tracked and stays empty when nothing is logged", async () => {
		const screen = await render(<IntakeScreen store={store(snapshot())} />);

		expect(
			await screen.findByText(
				"Choose what to track in settings and today's totals will appear here.",
			),
		).toBeTruthy();
		expect(screen.getByText("Nothing logged")).toBeTruthy();
		expect(screen.queryByText("Smoking & vaping")).toBeNull();
	});

	it("repeats a recent in one tap and confirms it", async () => {
		const day = snapshot({
			recents: [
				{
					event: {
						id: "event-1",
						kind: "drink",
						name: "Filter coffee",
						portionLabel: "250 ml mug",
					},
					detail: "",
					contributions: "",
				},
			] as IntakeDaySnapshot["recents"],
		});
		const intake = store(day);
		const screen = await render(<IntakeScreen store={intake} />);

		await fireEvent.press(
			await screen.findByLabelText("Log Filter coffee again"),
		);
		expect(intake.repeatEvent).toHaveBeenCalledWith("event-1");
		expect(await screen.findByText("Filter coffee added")).toBeTruthy();
	});

	it("leaves the bottom safe area to the tab navigator", async () => {
		const screen = await render(<IntakeScreen store={store(snapshot())} />);

		expect(await screen.findByTestId("safe-area-")).toBeTruthy();
		expect(screen.queryByTestId("safe-area-bottom")).toBeNull();
	});
});
