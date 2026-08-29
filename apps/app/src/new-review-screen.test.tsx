import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
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

describe("take stock screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		beforeRemove = null;
	});

	it("asks for one area at a time and saves every score together", async () => {
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);

		expect(await screen.findByText("1 of 3")).toBeTruthy();
		expect(screen.getByText("Work & career")).toBeTruthy();
		expect(screen.queryByText("Health")).toBeNull();

		await fireEvent.press(screen.getByLabelText("Work & career 6"));
		expect(await screen.findByText("2 of 3")).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("Health 9"));
		await fireEvent.press(await screen.findByLabelText("Money 3"));

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
		await fireEvent.press(screen.getByLabelText("Work & career 8"));
		expect(await screen.findByText("2 of 3")).toBeTruthy();
		expect(screen.queryByText(/^Last time/)).toBeNull();

		await fireEvent.press(screen.getByLabelText("Health 4"));
		expect(await screen.findByText("Last time 7.5/10")).toBeTruthy();
	});

	it("steps back through the areas and closes from the first one", async () => {
		const store = reviewStore();
		const screen = await render(<NewReviewScreen store={store} />);

		await fireEvent.press(await screen.findByLabelText("Work & career 6"));
		await fireEvent.press(await screen.findByLabelText("Previous area"));

		// The earlier answer is still selected, so a revisit shows what was said.
		expect(await screen.findByText("1 of 3")).toBeTruthy();
		expect(
			screen.getByLabelText("Work & career 6").props.accessibilityState
				.selected,
		).toBe(true);

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
		await fireEvent.press(await screen.findByLabelText("Work & career 6"));
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

		await fireEvent.press(await screen.findByLabelText("Work & career 6"));
		await fireEvent.press(await screen.findByLabelText("Health 9"));
		await fireEvent.press(await screen.findByLabelText("Money 3"));
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

		await fireEvent.press(screen.getByLabelText("Work & career 6"));
		await fireEvent.press(await screen.findByLabelText("Health 9"));
		await fireEvent.press(await screen.findByLabelText("Money 3"));
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

		await fireEvent.press(await screen.findByLabelText("Work & career 6"));
		await fireEvent.press(await screen.findByLabelText("Health 9"));
		await fireEvent.press(await screen.findByLabelText("Money 3"));
		await fireEvent.press(await screen.findByText("Save review"));

		expect(await screen.findByText("Disk full")).toBeTruthy();
		expect(screen.getByText("Nothing is saved until you finish.")).toBeTruthy();
		expect(router.replace).not.toHaveBeenCalled();
	});
});
