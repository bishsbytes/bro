import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { NewNoteScreen } from "./screens/notes/new-note-screen";
import { NotesScreen } from "./screens/notes/notes-screen";

jest.mock("expo-router", () => ({
	router: { back: jest.fn(), push: jest.fn() },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

const FIXED_NOW = () => new Date(2026, 7, 14, 12);

const NOTES = [
	{
		id: "today-1",
		localDay: "2026-08-14",
		body: "The first thought",
		createdAt: 1,
		updatedAt: 1,
	},
	{
		id: "today-2",
		localDay: "2026-08-14",
		body: "The second thought",
		createdAt: 2,
		updatedAt: 2,
	},
	{
		id: "yesterday-1",
		localDay: "2026-08-13",
		body: "An older thought",
		createdAt: 3,
		updatedAt: 3,
	},
];

describe("notes screens", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("lists all notes under their days, newest day first", async () => {
		const screen = await render(
			<NotesScreen
				now={FIXED_NOW}
				store={{
					listNotes: jest.fn(async () => ({
						notes: NOTES,
						hasMore: false,
					})),
				}}
			/>,
		);

		expect(await screen.findByText("Today")).toBeTruthy();
		expect(screen.getByText("Yesterday")).toBeTruthy();
		expect(screen.getByText("The first thought")).toBeTruthy();
		expect(screen.getByText("The second thought")).toBeTruthy();
		expect(screen.getByText("An older thought")).toBeTruthy();
		expect(screen.queryByText("Show older notes")).toBeNull();
	});

	it("opens the day a note belongs to so it can be edited", async () => {
		const screen = await render(
			<NotesScreen
				now={FIXED_NOW}
				store={{
					listNotes: jest.fn(async () => ({
						notes: NOTES,
						hasMore: false,
					})),
				}}
			/>,
		);

		await fireEvent.press(
			(await screen.findAllByLabelText("Edit notes for Today"))[0],
		);
		expect(router.push).toHaveBeenCalledWith("/history/2026-08-14");
	});

	it("widens the window rather than blanking the list to show older notes", async () => {
		const listNotes = jest
			.fn()
			.mockResolvedValueOnce({ notes: NOTES.slice(0, 2), hasMore: true })
			.mockResolvedValueOnce({ notes: NOTES, hasMore: false });
		const screen = await render(
			<NotesScreen now={FIXED_NOW} store={{ listNotes }} />,
		);

		expect(await screen.findByText("The first thought")).toBeTruthy();
		expect(listNotes).toHaveBeenLastCalledWith(30);

		await fireEvent.press(screen.getByText("Show older notes"));

		// The notes already on screen stay put while the wider read lands.
		expect(screen.getByText("The first thought")).toBeTruthy();
		expect(await screen.findByText("An older thought")).toBeTruthy();
		expect(listNotes).toHaveBeenLastCalledWith(60);
		await waitFor(() =>
			expect(screen.queryByText("Show older notes")).toBeNull(),
		);
	});

	it("offers the composer when there are no notes", async () => {
		const screen = await render(
			<NotesScreen
				now={FIXED_NOW}
				store={{
					listNotes: jest.fn(async () => ({ notes: [], hasMore: false })),
				}}
			/>,
		);

		await fireEvent.press(await screen.findByText("Add note"));
		expect(router.push).toHaveBeenCalledWith("/notes/new");
	});

	it("creates a note for the selected journal day", async () => {
		const createNote = jest.fn(async () => ({
			id: "new-1",
			localDay: "2026-08-12",
			body: "A clear head",
			createdAt: 4,
			updatedAt: 4,
		}));
		const screen = await render(
			<NewNoteScreen
				now={FIXED_NOW}
				initialLocalDay="2026-08-12"
				store={{ createNote }}
			/>,
		);

		expect(screen.getByText("What's on your mind?")).toBeTruthy();
		expect(screen.getByLabelText("Day").props.accessibilityValue).toEqual({
			text: "2026-08-12",
		});
		await fireEvent.changeText(screen.getByLabelText("Note"), "A clear head");
		await fireEvent.press(screen.getByText("Save note"));

		await waitFor(() =>
			expect(createNote).toHaveBeenCalledWith("2026-08-12", "A clear head"),
		);
		expect(router.back).toHaveBeenCalledTimes(1);
	});

	// A day out of the future, and two that are not days at all.
	it.each(["2026-08-20", "not-a-day", "2026-02-30"])(
		"falls back to today for %s, which the journal could not have meant",
		async (initialLocalDay) => {
			const screen = await render(
				<NewNoteScreen
					now={FIXED_NOW}
					initialLocalDay={initialLocalDay}
					store={{ createNote: jest.fn(async () => null) }}
				/>,
			);

			expect(screen.getByLabelText("Day").props.accessibilityValue).toEqual({
				text: "2026-08-14",
			});
		},
	);

	it("will not save a blank note, nor close the composer on one", async () => {
		const createNote = jest.fn(async () => null);
		const screen = await render(
			<NewNoteScreen now={FIXED_NOW} store={{ createNote }} />,
		);

		const save = screen.getByLabelText("Save note");
		expect(save.props.accessibilityState).toMatchObject({ disabled: true });

		await fireEvent.changeText(screen.getByLabelText("Note"), "   \n  ");
		expect(save.props.accessibilityState).toMatchObject({ disabled: true });
		await fireEvent.press(save);
		expect(createNote).not.toHaveBeenCalled();
		expect(router.back).not.toHaveBeenCalled();

		// A body the store still refuses says so rather than closing silently.
		await fireEvent.changeText(screen.getByLabelText("Note"), "A thought");
		await fireEvent.press(save);
		await waitFor(() =>
			expect(screen.getByText("Write something before saving.")).toBeTruthy(),
		);
		expect(router.back).not.toHaveBeenCalled();
	});

	it("keeps the composer open and reports a failed write", async () => {
		const createNote = jest.fn(async () => {
			throw new Error("database is locked");
		});
		const screen = await render(
			<NewNoteScreen now={FIXED_NOW} store={{ createNote }} />,
		);

		await fireEvent.changeText(screen.getByLabelText("Note"), "A thought");
		await fireEvent.press(screen.getByLabelText("Save note"));

		await waitFor(() =>
			expect(screen.getByText("database is locked")).toBeTruthy(),
		);
		expect(router.back).not.toHaveBeenCalled();
		// Still saveable: the failure released the button rather than wedging it.
		expect(
			screen.getByLabelText("Save note").props.accessibilityState,
		).toMatchObject({ disabled: false });
	});
});
