import { previousLocalDay } from "@bro/domain";
import { fireEvent, render } from "@testing-library/react-native";
import type {
	IntakeDaySnapshot,
	IntakeMetricSummary,
	IntakeStore,
	PresentedIntakeEntry,
	PresentedIntakeEvent,
} from "./intake/intake-store";
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

type Store = Pick<IntakeStore, "loadDay" | "updateEvent" | "deleteEvent">;

function total(
	slug: string,
	label: string,
	overrides: Partial<IntakeMetricSummary> = {},
): IntakeMetricSummary {
	return {
		metric: { slug, label },
		tracked: true,
		domain: "body",
		dayValue: null,
		dayFormatted: null,
		dayValueParts: null,
		meta: "so far today",
		gauge: null,
		read: null,
		goals: [],
		...overrides,
	} as unknown as IntakeMetricSummary;
}

function presented(
	id: string,
	name: string,
	time: [number, number],
	overrides: Partial<PresentedIntakeEvent["event"]> = {},
): PresentedIntakeEvent {
	return {
		event: {
			id,
			kind: "drink",
			name,
			brand: null,
			portionLabel: null,
			quantity: 1,
			localDay: "2026-09-02",
			occurredAt: new Date(2026, 8, 2, time[0], time[1]).getTime(),
			updatedAt: 1,
			...overrides,
		},
		detail: "",
		contributions: "",
	} as unknown as PresentedIntakeEvent;
}

function entry(
	events: PresentedIntakeEvent[],
	overrides: Partial<PresentedIntakeEntry> = {},
): PresentedIntakeEntry {
	const first = events[0] as PresentedIntakeEvent;
	return {
		key: first.event.id,
		time: "07:40",
		name: first.event.name,
		meta: null,
		value: "",
		events,
		accessibilityLabel: `${first.event.name}, row`,
		...overrides,
	};
}

function snapshot(
	overrides: Partial<IntakeDaySnapshot> = {},
): IntakeDaySnapshot {
	return {
		localDay: "2026-09-02",
		dayLabel: "Today",
		dayDate: "Wednesday 2 September",
		isToday: true,
		defaultTime: "12:00",
		enabledKinds: ["food", "drink"],
		events: [],
		entries: [],
		metrics: [],
		totals: [],
		...overrides,
	};
}

/**
 * The screen asks for the real today first, then for whichever day its arrows
 * choose; only the day before the snapshot's own day answers differently.
 */
function store(day: IntakeDaySnapshot): Store {
	const dayBefore = previousLocalDay(day.localDay);
	return {
		loadDay: jest.fn(async (localDay: string) =>
			localDay === dayBefore
				? {
						...day,
						localDay,
						dayLabel: "Yesterday",
						dayDate: "Tuesday 1 September",
						isToday: false,
						events: [],
						entries: [],
					}
				: day,
		),
		updateEvent: jest.fn(async () => day.events[0]?.event),
		deleteEvent: jest.fn(async () => undefined),
	} as unknown as Store;
}

describe("Intake screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("draws one compact gauge per tracked total against the usual band and states it as fact", async () => {
		const screen = await render(
			<IntakeScreen
				store={store(
					snapshot({
						totals: [
							total("energy_intake", "Energy intake", {
								dayValue: 1850,
								dayFormatted: "1,850 kcal",
								dayValueParts: { value: "1,850", unit: "kcal" },
								gauge: {
									rail: { min: 0, max: 3000 },
									railLabels: { min: "0", max: "3,000" },
									band: { min: 2100, max: 2600 },
								},
								read: "Your days usually land between 2,100 and 2,600.",
							}),
							total("ethanol_intake", "Alcohol", {
								domain: "load",
								meta: null,
								read: "Most of your days: none.",
							}),
							total("caffeine_intake", "Caffeine", {
								dayValue: 180,
								dayFormatted: "180 mg",
								dayValueParts: { value: "180", unit: "mg" },
								meta: "last at 14:10",
							}),
						],
					}),
				)}
			/>,
		);

		expect(await screen.findByText("Today")).toBeTruthy();
		expect(screen.getByText("Wednesday 2 September")).toBeTruthy();
		expect(
			screen.getByLabelText(
				"Energy intake, 1,850 kcal. Your days usually land between 2,100 and 2,600.",
			),
		).toBeTruthy();
		expect(
			screen.getByText("Your days usually land between 2,100 and 2,600."),
		).toBeTruthy();
		// Only the total with a usual range draws a band; the others state the number alone.
		expect(screen.getAllByTestId("gauge-band")).toHaveLength(1);
		expect(screen.getByText("Most of your days: none.")).toBeTruthy();
		expect(screen.getByText("last at 14:10")).toBeTruthy();
		// A tracked total with nothing logged reads as a dash, never a zero or a grade.
		expect(screen.getAllByText("—").length).toBeGreaterThan(0);
		expect(
			screen.getByText(
				"A usual range appears once a total has 14 logged days.",
			),
		).toBeTruthy();
		// Totals are stated, never graded: nothing counts down or judges.
		expect(
			screen.queryByText(/remaining|left today|\bover\b|\bunder\b|budget/i),
		).toBeNull();
		expect(
			screen.getByText(
				"Totals are stated without targets, allowances, or ratings.",
			),
		).toBeTruthy();
		// Logging is the shared FAB's job; the card carries no button of its own.
		expect(screen.queryByText("Log something")).toBeNull();
	});

	it("lists the day as rows on a timeline with repeats grouped, and edits an entry in a sheet", async () => {
		const coffee = presented("event-1", "Filter coffee", [7, 40], {
			portionLabel: "250 ml mug",
		});
		const firstPint = presented("event-2", "Lager, 4.5%", [18, 17], {
			portionLabel: "pint",
		});
		const secondPint = presented("event-3", "Lager, 4.5%", [18, 40], {
			portionLabel: "pint",
		});
		const day = snapshot({
			events: [coffee, firstPint, secondPint],
			entries: [
				entry([coffee], {
					time: "07:40",
					meta: "1 × 250 ml mug",
					value: "95 mg",
					accessibilityLabel: "Filter coffee, 95 mg, at 07:40",
				}),
				entry([firstPint, secondPint], {
					time: "18:17",
					meta: "2 × pint",
					value: "5.1 units · 489 kcal",
					accessibilityLabel:
						"Lager, 4.5%, 2 × pint, 5.1 units · 489 kcal, at 18:17",
				}),
			],
		});
		const intake = store(day);
		const screen = await render(<IntakeScreen store={intake} />);

		// The summary comes first; the entries sit behind the card's other tab.
		expect(await screen.findByText("Today")).toBeTruthy();
		expect(screen.queryByText("2 × pint")).toBeNull();
		await fireEvent.press(screen.getByLabelText("Logged"));
		expect(await screen.findByText("3 entries")).toBeTruthy();
		expect(screen.getByText("2 × pint")).toBeTruthy();
		expect(screen.getByText("5.1 units · 489 kcal")).toBeTruthy();
		// The same lager twice is one row, not two.
		expect(screen.getAllByText("Lager, 4.5%")).toHaveLength(1);

		// A grouped row lists its entries first; each is corrected on its own.
		await fireEvent.press(screen.getByLabelText(/^Lager, 4.5%, 2 × pint/));
		expect(
			await screen.findByText(
				"2 entries at this sitting. Choose one to change it.",
			),
		).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("Change the entry at 18:40"));
		expect(await screen.findByText("Edit entry")).toBeTruthy();
		await fireEvent.changeText(screen.getByLabelText("Quantity"), "2");
		await fireEvent.press(screen.getByText("Save changes"));
		expect(intake.updateEvent).toHaveBeenCalledWith("event-3", {
			name: "Lager, 4.5%",
			portionLabel: "pint",
			quantity: 2,
			localDay: "2026-09-02",
			time: "18:40",
		});

		// A single entry opens straight into its editor, where delete lives.
		await fireEvent.press(screen.getByLabelText(/^Filter coffee/));
		await fireEvent.press(await screen.findByText("Delete entry"));
		expect(intake.deleteEvent).toHaveBeenCalledWith("event-1");
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("says how to get totals when nothing is tracked and stays empty when nothing is logged", async () => {
		const screen = await render(<IntakeScreen store={store(snapshot())} />);

		expect(
			await screen.findByText(
				"Choose what to track in intake settings and the day's totals will appear here.",
			),
		).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("Logged"));
		expect(await screen.findByText("Nothing logged")).toBeTruthy();
		expect(screen.queryByText("Smoking & vaping")).toBeNull();
		expect(screen.queryByText(/usual range appears/)).toBeNull();
	});

	it("walks back through the days from the card and stops at today", async () => {
		const intake = store(snapshot());
		const screen = await render(<IntakeScreen store={intake} />);

		expect(await screen.findByText("Today")).toBeTruthy();
		expect(
			screen.getByLabelText("Next day").props.accessibilityState,
		).toMatchObject({ disabled: true });

		await fireEvent.press(screen.getByLabelText("Previous day"));
		expect(intake.loadDay).toHaveBeenLastCalledWith("2026-09-01");
		expect(await screen.findByText("Yesterday")).toBeTruthy();
		expect(screen.getByText("Tuesday 1 September")).toBeTruthy();
		expect(screen.queryByText(/\d{4}-\d{2}-\d{2}/)).toBeNull();

		await fireEvent.press(screen.getByLabelText("Next day"));
		expect(intake.loadDay).toHaveBeenLastCalledWith("2026-09-02");
		expect(await screen.findByText("Today")).toBeTruthy();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("leaves the bottom safe area to the tab navigator", async () => {
		const screen = await render(<IntakeScreen store={store(snapshot())} />);

		expect(await screen.findByTestId("safe-area-")).toBeTruthy();
		expect(screen.queryByTestId("safe-area-bottom")).toBeNull();
	});
});
