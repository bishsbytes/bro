import {
	act,
	fireEvent,
	type RenderResult,
	render,
	waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import { AccessibilityInfo } from "react-native";
import type { ReviewDraft, ReviewResult } from "./review/review-store";
import { NewReviewScreen } from "./screens/review/new-review-screen";

type RemoveListener = (event: { preventDefault: () => void }) => void;

let beforeRemove: RemoveListener | null = null;

jest.mock("expo-router", () => ({
	router: { back: jest.fn(), replace: jest.fn() },
	useNavigation: () => ({
		addListener: (event: string, listener: RemoveListener) => {
			if (event === "beforeRemove") {
				beforeRemove = listener;
			}
			return () => undefined;
		},
	}),
}));

const AREAS = [
	{ slug: "work", label: "Work & career", position: 1 },
	{ slug: "health", label: "Health", position: 2 },
	{ slug: "money", label: "Money", position: 3 },
] as const;

function draftOf(previousScores: Record<string, number> = {}): ReviewDraft {
	return { startedAt: 1, items: [...AREAS], previousScores };
}

function reviewStore(
	draft: ReviewDraft = draftOf(),
	completeSitting = jest.fn(
		async () =>
			({ assessment: { id: "assessment-1" } }) as unknown as ReviewResult,
	),
) {
	return { beginSitting: jest.fn(async () => draft), completeSitting };
}

/** Fires the navigation guard the way a swipe or hardware back would. */
async function pressSystemBack() {
	const preventDefault = jest.fn();
	const listener = beforeRemove;
	if (!listener) throw new Error("Expected a beforeRemove listener.");
	await act(async () => {
		listener({ preventDefault });
	});
	return preventDefault;
}

/** Taps a stop the way a finger does: the rail is measured, then pressed at
 *  the centre of the stop wanted. */
async function chooseScore(view: RenderResult, prefix: string, score: number) {
	const scale = await view.findByLabelText(`${prefix} score`);
	const width = 1000;
	await fireEvent(
		view.getByTestId("discrete-scale-points", { includeHiddenElements: true }),
		"layout",
		{ nativeEvent: { layout: { x: 0, y: 0, width, height: 64 } } },
	);
	await fireEvent.press(scale, {
		nativeEvent: {
			locationX: undefined,
			offsetX: (score - 0.5) * (width / 10),
			locationY: 32,
		},
	});
}

/** One step of a screen reader's swipe or an arrow key on the rail. */
async function adjustScore(view: RenderResult, prefix: string) {
	const scale = await view.findByLabelText(`${prefix} score`);
	await fireEvent(scale, "accessibilityAction", {
		nativeEvent: { actionName: "increment" },
	});
}

describe("take stock screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		beforeRemove = null;
		// General flow tests cover the reduced-motion path without waiting. The
		// confirmation test below opts into the Helm motion duration.
		jest
			.spyOn(AccessibilityInfo, "isReduceMotionEnabled")
			.mockResolvedValue(true);
	});
	afterEach(() => jest.restoreAllMocks());

	it("briefly shows the committed score before moving to the next area", async () => {
		jest
			.mocked(AccessibilityInfo.isReduceMotionEnabled)
			.mockResolvedValue(false);
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);
		await act(async () => Promise.resolve());

		await chooseScore(screen, "Work & career", 6);

		expect(screen.getByText("1 of 3")).toBeTruthy();
		expect(
			screen.getByLabelText("Work & career score").props.accessibilityValue.now,
		).toBe(6);
		expect(await screen.findByText("2 of 3")).toBeTruthy();
	});

	it("holds the area open while a screen reader steps through the scale", async () => {
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);
		expect(await screen.findByText("1 of 3")).toBeTruthy();

		// Every increment lands on a value the rail announces, and none of them
		// is the answer: leaving on the first would record a 1 and move on.
		await adjustScore(screen, "Work & career");
		await adjustScore(screen, "Work & career");
		await adjustScore(screen, "Work & career");

		expect(screen.getByText("1 of 3")).toBeTruthy();
		expect(
			screen.getByLabelText("Work & career score").props.accessibilityValue.now,
		).toBe(3);

		// Nothing moves on by itself, so the step offers its own way forward.
		await fireEvent.press(screen.getByText("Next"));
		expect(await screen.findByText("2 of 3")).toBeTruthy();
		expect(screen.queryByText("Next")).toBeNull();
	});

	it("keeps an adjusted score when the area is answered by adjustment alone", async () => {
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);
		expect(await screen.findByText("1 of 3")).toBeTruthy();

		await adjustScore(screen, "Work & career");
		await fireEvent.press(screen.getByText("Next"));
		await chooseScore(screen, "Health", 9);
		await chooseScore(screen, "Money", 3);

		expect(await screen.findByText("Choose your focus")).toBeTruthy();
		await fireEvent.press(screen.getByText("Save review"));
		await waitFor(() =>
			expect(store.completeSitting).toHaveBeenCalledWith(
				draftOf(),
				{ work: 1, health: 9, money: 3 },
				[],
			),
		);
	});

	it("asks for one area at a time and saves every score together", async () => {
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);

		expect(await screen.findByText("1 of 3")).toBeTruthy();
		expect(screen.getByText("Work & career")).toBeTruthy();
		expect(screen.queryByText("Health")).toBeNull();
		expect(screen.getByText("Very low")).toBeTruthy();
		expect(screen.getByText("Very good")).toBeTruthy();
		expect(
			screen.getByLabelText("Work & career score").props.accessibilityRole,
		).toBe("adjustable");

		await chooseScore(screen, "Work & career", 6);
		expect(await screen.findByText("2 of 3")).toBeTruthy();
		await chooseScore(screen, "Health", 9);
		await chooseScore(screen, "Money", 3);

		// The last answer opens the focus step rather than a fourth scale.
		expect(await screen.findByText("Choose your focus")).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("Focus on Health"));
		await fireEvent.press(screen.getByText("Save review"));

		await waitFor(() =>
			expect(store.completeSitting).toHaveBeenCalledWith(
				draftOf(),
				{ work: 6, health: 9, money: 3 },
				["health"],
			),
		);
		expect(router.replace).toHaveBeenCalledWith({
			pathname: "/review/[id]",
			params: { id: "assessment-1" },
		});
	});

	it("shows what the last review scored the area being rated", async () => {
		const store = reviewStore(draftOf({ work: 6, money: 7.5 }));
		const screen = await render(<NewReviewScreen store={store} />);

		expect(await screen.findByText("Last time 6/10")).toBeTruthy();

		// An area the previous wheel did not carry simply says nothing.
		await chooseScore(screen, "Work & career", 8);
		expect(await screen.findByText("2 of 3")).toBeTruthy();
		expect(screen.queryByText(/^Last time/)).toBeNull();

		await chooseScore(screen, "Health", 4);
		expect(await screen.findByText("Last time 7.5/10")).toBeTruthy();
	});

	it("steps back through the areas and closes from the first one", async () => {
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);

		await chooseScore(screen, "Work & career", 6);
		await fireEvent.press(await screen.findByLabelText("Previous area"));

		// The earlier answer is still selected, so a revisit shows what was said.
		expect(await screen.findByText("1 of 3")).toBeTruthy();
		expect(
			screen.getByLabelText("Work & career score").props.accessibilityValue.now,
		).toBe(6);

		await fireEvent.press(screen.getByLabelText("Close review"));
		expect(await screen.findByText("Discard this review?")).toBeTruthy();
		expect(router.back).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("Discard"));
		expect(router.back).toHaveBeenCalled();
		expect(store.completeSitting).not.toHaveBeenCalled();
	});

	it("leaves straight away when nothing has been scored", async () => {
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);

		await fireEvent.press(await screen.findByLabelText("Close review"));
		expect(router.back).toHaveBeenCalled();
		expect(screen.queryByText("Discard this review?")).toBeNull();
	});

	it("turns a system back into a step back rather than losing the scores", async () => {
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);
		await chooseScore(screen, "Work & career", 6);
		expect(await screen.findByText("2 of 3")).toBeTruthy();

		expect(await pressSystemBack()).toHaveBeenCalled();
		expect(await screen.findByText("1 of 3")).toBeTruthy();

		// Back again from the first area asks before dropping the scores.
		expect(await pressSystemBack()).toHaveBeenCalled();
		expect(await screen.findByText("Discard this review?")).toBeTruthy();
		expect(screen.getByText("Your 1 score has not been saved.")).toBeTruthy();

		await fireEvent.press(screen.getByText("Keep going"));
		expect(await screen.findByText("1 of 3")).toBeTruthy();
	});

	it("lets an unstarted review be left by a system back", async () => {
		const store = reviewStore();
		await render(<NewReviewScreen store={store} />);
		await waitFor(() => expect(beforeRemove).not.toBeNull());

		expect(await pressSystemBack()).not.toHaveBeenCalled();
	});

	it("returns to a single area from the focus step", async () => {
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);

		await chooseScore(screen, "Work & career", 6);
		await chooseScore(screen, "Health", 9);
		await chooseScore(screen, "Money", 3);
		expect(await screen.findByText("Choose your focus")).toBeTruthy();

		// The score on a focus card leads back to the area that set it.
		await fireEvent.press(screen.getByLabelText("Change Health score"));
		expect(await screen.findByText("2 of 3")).toBeTruthy();

		// Everything is answered, so the flow can be rejoined at the end.
		await fireEvent.press(screen.getByLabelText("Choose focus areas"));
		expect(await screen.findByText("Choose your focus")).toBeTruthy();
	});

	it("only offers the shortcut to the focus step once every area is scored", async () => {
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);

		await waitFor(() => expect(screen.getByText("1 of 3")).toBeTruthy());
		expect(screen.queryByLabelText("Choose focus areas")).toBeNull();

		await chooseScore(screen, "Work & career", 6);
		await chooseScore(screen, "Health", 9);
		await chooseScore(screen, "Money", 3);
		await fireEvent.press(await screen.findByText("Change scores"));

		expect(await screen.findByText("3 of 3")).toBeTruthy();
		expect(screen.getByLabelText("Choose focus areas")).toBeTruthy();
	});

	it("keeps the scores on screen when the save fails", async () => {
		const store = reviewStore(
			draftOf(),
			jest.fn(async () => {
				throw new Error("Disk full");
			}),
		);
		const screen = await render(<NewReviewScreen store={store} />);

		await chooseScore(screen, "Work & career", 6);
		await chooseScore(screen, "Health", 9);
		await chooseScore(screen, "Money", 3);
		await fireEvent.press(await screen.findByText("Save review"));

		expect(await screen.findByText("Disk full")).toBeTruthy();
		expect(screen.getByText("Nothing is saved until you finish.")).toBeTruthy();
		expect(router.replace).not.toHaveBeenCalled();
	});
});
