import { listScoredMetrics } from "@bro/domain/metric-registry";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import type { CheckInEntry, TodayCheckIn } from "./check-in/check-in-store";
import { CheckInScreen } from "./screens/check-in/check-in-screen";

jest.mock("expo-router", () => ({
	router: { back: jest.fn() },
}));

const OPTIONAL_SLUGS = ["energy", "motivation", "productivity", "libido"];

const today: TodayCheckIn = {
	localDay: "2026-08-14",
	entries: [],
	availableOptionalScores: listScoredMetrics().filter((metric) =>
		OPTIONAL_SLUGS.includes(metric.slug),
	),
	selectedTagSlugs: [],
	availableTags: [],
	availableMeasurements: [],
	loggedMeasurements: [],
	inputLocale: "en-GB",
	note: "",
};

function observation(
	metricSlug: string,
	value: number,
	id = `${metricSlug}-1`,
) {
	return {
		id,
		metricSlug,
		value,
		scaleMin: 1,
		scaleMax: 5,
		observedAt: Date.parse("2026-08-14T10:00:00.000Z"),
		localDay: "2026-08-14",
		tzOffsetMinutes: -60,
		source: "user",
		sourceRecordId: null,
		assessmentId: null,
		createdAt: 1,
		updatedAt: 1,
	};
}

function entryOf(mood: number, optional: readonly [string, number][]) {
	const moodRow = observation("mood", mood);
	return {
		id: moodRow.id,
		observedAt: moodRow.observedAt,
		mood: moodRow,
		optionalScores: optional.map(([slug, value]) => observation(slug, value)),
	} satisfies CheckInEntry;
}

function checkInStore(snapshot: TodayCheckIn = today) {
	return {
		loadToday: jest.fn(async () => snapshot),
		saveCheckIn: jest.fn(async () => snapshot),
	};
}

describe("check-in screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("asks one score at a time and writes them in a single save", async () => {
		const store = checkInStore();
		const screen = await render(
			<CheckInScreen store={store} initialMood={4} />,
		);

		// Mood was answered on Today, so the flow opens on the next prompt and
		// only ever shows one scale at a time.
		expect(await screen.findByLabelText("Energy 3")).toBeTruthy();
		expect(screen.queryByLabelText("Motivation 5")).toBeNull();
		expect(screen.getByText("2 of 5")).toBeTruthy();

		await fireEvent.press(screen.getByLabelText("Energy 3"));
		expect(screen.queryByLabelText("Energy 3")).toBeNull();
		await fireEvent.press(await screen.findByLabelText("Motivation 5"));
		await fireEvent.press(await screen.findByLabelText("Productivity 4"));
		expect(store.saveCheckIn).not.toHaveBeenCalled();
		await fireEvent.press(await screen.findByLabelText("Libido 2"));

		// Answering the last prompt is the save; there is no save button.
		await waitFor(() =>
			expect(store.saveCheckIn).toHaveBeenCalledWith(
				{
					mood: 4,
					optional: {
						energy: 3,
						motivation: 5,
						productivity: 4,
						libido: 2,
					},
				},
				null,
			),
		);
		expect(store.saveCheckIn).toHaveBeenCalledTimes(1);
		expect(await screen.findByText("Checked in")).toBeTruthy();
		expect(
			screen.getByText(
				"Mood 4 · Energy 3 · Motivation 5 · Productivity 4 · Libido 2",
			),
		).toBeTruthy();

		await fireEvent.press(screen.getByText("Done"));
		expect(router.back).toHaveBeenCalled();
	});

	it("starts on Mood when the flow is opened without one", async () => {
		const store = checkInStore({
			...today,
			availableOptionalScores: listScoredMetrics().filter(
				(metric) => metric.slug === "energy",
			),
		});
		const screen = await render(<CheckInScreen store={store} />);

		expect(await screen.findByText("1 of 2")).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("Mood 5"));
		await fireEvent.press(await screen.findByLabelText("Energy 4"));

		await waitFor(() =>
			expect(store.saveCheckIn).toHaveBeenCalledWith(
				{ mood: 5, optional: { energy: 4 } },
				null,
			),
		);
	});

	it("leaves a skipped score out of the check-in", async () => {
		const store = checkInStore({
			...today,
			availableOptionalScores: listScoredMetrics().filter((metric) =>
				["energy", "motivation"].includes(metric.slug),
			),
		});
		const screen = await render(
			<CheckInScreen store={store} initialMood={3} />,
		);

		await fireEvent.press(await screen.findByText("Skip"));
		await fireEvent.press(await screen.findByLabelText("Motivation 2"));

		await waitFor(() =>
			expect(store.saveCheckIn).toHaveBeenCalledWith(
				{ mood: 3, optional: { motivation: 2 } },
				null,
			),
		);
	});

	it("saves what was answered when the flow is closed early", async () => {
		const store = checkInStore();
		const screen = await render(
			<CheckInScreen store={store} initialMood={2} />,
		);

		await fireEvent.press(await screen.findByLabelText("Energy 1"));
		await fireEvent.press(await screen.findByLabelText("Finish check-in"));

		await waitFor(() =>
			expect(store.saveCheckIn).toHaveBeenCalledWith(
				{ mood: 2, optional: { energy: 1 } },
				null,
			),
		);
		expect(router.back).not.toHaveBeenCalled();
		await fireEvent.press(await screen.findByText("Done"));
		expect(router.back).toHaveBeenCalled();
	});

	it("rewrites the entry it was opened on instead of adding another", async () => {
		const entry = entryOf(2, [["energy", 3]]);
		const store = checkInStore({
			...today,
			entries: [entry],
			availableOptionalScores: listScoredMetrics().filter(
				(metric) => metric.slug === "energy",
			),
		});
		const screen = await render(
			<CheckInScreen store={store} entryId={entry.id} />,
		);

		// The existing scores are seeded, so an untouched prompt keeps its value.
		await waitFor(() =>
			expect(
				screen.getByLabelText("Mood 2").props.accessibilityState.selected,
			).toBe(true),
		);
		await fireEvent.press(screen.getByLabelText("Mood 5"));
		await fireEvent.press(await screen.findByLabelText("Energy 4"));

		await waitFor(() =>
			expect(store.saveCheckIn).toHaveBeenCalledWith(
				{ mood: 5, optional: { energy: 4 } },
				entry,
			),
		);
		expect(await screen.findByText("Check-in updated")).toBeTruthy();
	});

	it("does not add a second check-in when an answer is changed after saving", async () => {
		const created = entryOf(4, [["energy", 3]]);
		const store = checkInStore({
			...today,
			availableOptionalScores: listScoredMetrics().filter(
				(metric) => metric.slug === "energy",
			),
		});
		store.saveCheckIn.mockImplementation(async () => ({
			...today,
			entries: [created],
		}));
		const screen = await render(
			<CheckInScreen store={store} initialMood={4} />,
		);

		await fireEvent.press(await screen.findByLabelText("Energy 3"));
		await fireEvent.press(await screen.findByText("Change an answer"));
		await fireEvent.press(await screen.findByLabelText("Energy 5"));

		await waitFor(() => expect(store.saveCheckIn).toHaveBeenCalledTimes(2));
		// The second save edits the entry the first one created.
		expect(store.saveCheckIn).toHaveBeenLastCalledWith(
			{ mood: 4, optional: { energy: 5 } },
			created,
		);
	});

	it("keeps the answers on screen when the save fails", async () => {
		const store = checkInStore({
			...today,
			availableOptionalScores: listScoredMetrics().filter(
				(metric) => metric.slug === "energy",
			),
		});
		store.saveCheckIn.mockRejectedValueOnce(new Error("Disk is full"));
		const screen = await render(
			<CheckInScreen store={store} initialMood={4} />,
		);

		await fireEvent.press(await screen.findByLabelText("Energy 3"));

		expect(await screen.findByText("Disk is full")).toBeTruthy();
		expect(router.back).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByText("Try again"));
		await waitFor(() => expect(store.saveCheckIn).toHaveBeenCalledTimes(2));
		expect(await screen.findByText("Checked in")).toBeTruthy();
	});
});
