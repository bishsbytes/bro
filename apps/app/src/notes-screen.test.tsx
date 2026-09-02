import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { EditNoteScreen } from "./screens/notes/edit-note-screen";
import { NewNoteScreen } from "./screens/notes/new-note-screen";
import { NotesScreen } from "./screens/notes/notes-screen";

type RemoveListener = (event: { preventDefault: () => void }) => void;

let beforeRemove: RemoveListener | null = null;
let mockRenderedLinkPress: ((event: { url: string }) => void) | undefined;

jest.mock("react-native-enriched-markdown", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const shipped = jest.requireActual<
		typeof import("react-native-enriched-markdown")
	>("react-native-enriched-markdown/jest");

	return {
		...shipped,
		EnrichedMarkdownText: ({
			onLinkPress,
			...props
		}: React.ComponentProps<typeof shipped.EnrichedMarkdownText>) => {
			mockRenderedLinkPress = onLinkPress;
			return React.createElement(shipped.EnrichedMarkdownText, props);
		},
	};
});

jest.mock("expo-router", () => ({
	router: { back: jest.fn(), push: jest.fn() },
	useNavigation: () => ({
		addListener: (event: string, listener: RemoveListener) => {
			if (event === "beforeRemove") beforeRemove = listener;
			return () => undefined;
		},
	}),
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
	// Renders the header the screen asks for inline, so what the reader would
	// see in the navigation bar — its title and its actions — is queryable from
	// the tree.
	Stack: {
		Screen: ({
			options,
		}: {
			options?: { title?: string; headerRight?: () => React.ReactNode };
		}) => {
			const React = jest.requireActual<typeof import("react")>("react");
			const { Text } =
				jest.requireActual<typeof import("react-native")>("react-native");
			return React.createElement(
				React.Fragment,
				null,
				options?.title ? React.createElement(Text, null, options.title) : null,
				options?.headerRight?.() ?? null,
			);
		},
	},
}));

async function pressSystemBack() {
	const preventDefault = jest.fn();
	const listener = beforeRemove;
	if (!listener) throw new Error("Expected a beforeRemove listener.");
	await act(async () => listener({ preventDefault }));
	return preventDefault;
}

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
		beforeRemove = null;
		mockRenderedLinkPress = undefined;
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
		expect(screen.getByLabelText("Open note 1 of 2 from Today")).toBeTruthy();
		expect(screen.getByLabelText("Open note 2 of 2 from Today")).toBeTruthy();
		expect(screen.queryByText("Show older notes")).toBeNull();
	});

	it("opens a note on its own screen so it can be edited", async () => {
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
			await screen.findByLabelText("Open note 1 of 2 from Today"),
		);
		expect(router.push).toHaveBeenCalledWith("/notes/today-1");
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

		expect(screen.getByPlaceholderText("What's on your mind?")).toBeTruthy();
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

	it("names the day in the header, in the words the reader thinks in", async () => {
		const screen = await render(
			<NewNoteScreen
				now={FIXED_NOW}
				initialLocalDay="2026-08-13"
				store={{ createNote: jest.fn(async () => null) }}
			/>,
		);

		expect(screen.getByText("Yesterday")).toBeTruthy();
		expect(screen.queryByText("Day")).toBeNull();
	});

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

	it("leaves without ceremony when there is nothing written to lose", async () => {
		const screen = await render(
			<NewNoteScreen
				now={FIXED_NOW}
				store={{ createNote: jest.fn(async () => null) }}
			/>,
		);

		await fireEvent.press(screen.getByLabelText("Discard"));
		expect(screen.queryByText("Discard this note?")).toBeNull();
		expect(router.back).toHaveBeenCalledTimes(1);
	});

	it("asks before throwing away words already written", async () => {
		const screen = await render(
			<NewNoteScreen
				now={FIXED_NOW}
				store={{ createNote: jest.fn(async () => null) }}
			/>,
		);
		await fireEvent.changeText(screen.getByLabelText("Note"), "Half a thought");

		await fireEvent.press(screen.getByLabelText("Discard"));
		expect(screen.getByText("Discard this note?")).toBeTruthy();
		expect(router.back).not.toHaveBeenCalled();

		// Backing out of the prompt returns the words, not an empty composer.
		await fireEvent.press(screen.getByLabelText("Keep writing"));
		expect(screen.queryByText("Discard this note?")).toBeNull();
		expect(screen.getByLabelText("Note").props.value).toBe("Half a thought");
		expect(router.back).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByLabelText("Discard"));
		await fireEvent.press(screen.getByLabelText("Discard"));
		expect(router.back).toHaveBeenCalledTimes(1);
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

describe("note editor", () => {
	const NOTE = NOTES[0];

	beforeEach(() => {
		jest.clearAllMocks();
		beforeRemove = null;
		mockRenderedLinkPress = undefined;
	});

	function editor(store: Parameters<typeof EditNoteScreen>[0]["store"]) {
		return render(
			<EditNoteScreen noteId={NOTE.id} now={FIXED_NOW} store={store} />,
		);
	}

	it("opens the note as it was written, under the day it belongs to", async () => {
		const screen = await editor({
			loadNote: jest.fn(async () => NOTE),
			updateNote: jest.fn(),
			deleteNote: jest.fn(),
		});

		expect(await screen.findByText("The first thought")).toBeTruthy();
		expect(screen.queryByLabelText("Note")).toBeNull();
		expect(screen.getByLabelText("Edit note")).toBeTruthy();
		// The header names the day rather than repeating "Note".
		expect(screen.getByText("Today")).toBeTruthy();
	});

	it("opens a link from the note's reading view", async () => {
		const openUrl = jest.fn(async () => undefined);
		const screen = await render(
			<EditNoteScreen
				noteId={NOTE.id}
				now={FIXED_NOW}
				store={{
					loadNote: jest.fn(async () => ({
						...NOTE,
						body: "[Optimisr](https://optimisr.app)",
					})),
					updateNote: jest.fn(),
					deleteNote: jest.fn(),
				}}
				openUrl={openUrl}
			/>,
		);

		expect(
			await screen.findByText("[Optimisr](https://optimisr.app)"),
		).toBeTruthy();
		await act(async () => {
			mockRenderedLinkPress?.({ url: "https://optimisr.app" });
		});

		expect(openUrl).toHaveBeenCalledWith("https://optimisr.app");
	});

	it("saves an edit and returns to where it was opened from", async () => {
		const updateNote = jest.fn(async () => ({
			...NOTE,
			body: "A second thought",
		}));
		const screen = await editor({
			loadNote: jest.fn(async () => NOTE),
			updateNote,
			deleteNote: jest.fn(),
		});

		await fireEvent.press(await screen.findByLabelText("Edit note"));
		await fireEvent.changeText(
			await screen.findByLabelText("Note"),
			"A second thought",
		);
		await fireEvent.press(screen.getByLabelText("Save note"));

		await waitFor(() =>
			expect(updateNote).toHaveBeenCalledWith("today-1", "A second thought"),
		);
		expect(router.back).toHaveBeenCalledTimes(1);
	});

	it("saves the note untouched when nothing was typed", async () => {
		const updateNote = jest.fn(async () => NOTE);
		const screen = await editor({
			loadNote: jest.fn(async () => NOTE),
			updateNote,
			deleteNote: jest.fn(),
		});

		await fireEvent.press(await screen.findByLabelText("Edit note"));
		await fireEvent.press(screen.getByLabelText("Save note"));

		await waitFor(() =>
			expect(updateNote).toHaveBeenCalledWith("today-1", "The first thought"),
		);
	});

	it("loads a new draft when the dynamic note route changes", async () => {
		const loadNote = jest.fn(
			async (id: string) => NOTES.find((note) => note.id === id) ?? null,
		);
		const updateNote = jest.fn(async (id: string, body: string) => ({
			...(NOTES.find((note) => note.id === id) ?? NOTES[0]),
			id,
			body,
		}));
		const store = { loadNote, updateNote, deleteNote: jest.fn() };
		const screen = await render(
			<EditNoteScreen noteId="today-1" now={FIXED_NOW} store={store} />,
		);

		await fireEvent.press(await screen.findByLabelText("Edit note"));
		await fireEvent.changeText(
			await screen.findByLabelText("Note"),
			"An unsaved first-note edit",
		);
		screen.rerender(
			<EditNoteScreen noteId="today-2" now={FIXED_NOW} store={store} />,
		);

		expect(await screen.findByText("The second thought")).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("Edit note"));
		await fireEvent.press(screen.getByLabelText("Save note"));
		await waitFor(() =>
			expect(updateNote).toHaveBeenCalledWith("today-2", "The second thought"),
		);
	});

	it("asks before navigation discards an edit", async () => {
		const screen = await editor({
			loadNote: jest.fn(async () => NOTE),
			updateNote: jest.fn(),
			deleteNote: jest.fn(),
		});
		await fireEvent.press(await screen.findByLabelText("Edit note"));
		await fireEvent.changeText(
			await screen.findByLabelText("Note"),
			"A changed thought",
		);

		const firstBack = await pressSystemBack();
		expect(firstBack).toHaveBeenCalledTimes(1);
		expect(screen.getByText("Discard these changes?")).toBeTruthy();
		expect(router.back).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByLabelText("Keep editing"));
		expect(screen.queryByText("Discard these changes?")).toBeNull();

		await pressSystemBack();
		await fireEvent.press(screen.getByLabelText("Discard changes"));
		expect(router.back).toHaveBeenCalledTimes(1);
	});

	it("will not save a note emptied out", async () => {
		const updateNote = jest.fn();
		const screen = await editor({
			loadNote: jest.fn(async () => NOTE),
			updateNote,
			deleteNote: jest.fn(),
		});

		await fireEvent.press(await screen.findByLabelText("Edit note"));
		await fireEvent.changeText(await screen.findByLabelText("Note"), "   ");
		await fireEvent.press(screen.getByLabelText("Save note"));

		expect(updateNote).not.toHaveBeenCalled();
		expect(
			screen.getByLabelText("Save note").props.accessibilityState,
		).toMatchObject({ disabled: true });
	});

	it("asks before deleting, and deletes once asked twice", async () => {
		const deleteNote = jest.fn(async () => true);
		const screen = await editor({
			loadNote: jest.fn(async () => NOTE),
			updateNote: jest.fn(),
			deleteNote,
		});

		await fireEvent.press(await screen.findByLabelText("Delete note"));
		expect(screen.getByText("Delete this note?")).toBeTruthy();
		expect(deleteNote).not.toHaveBeenCalled();

		// Backing out of the prompt leaves the note alone.
		await fireEvent.press(screen.getByLabelText("Keep note"));
		expect(screen.queryByText("Delete this note?")).toBeNull();

		await fireEvent.press(screen.getByLabelText("Delete note"));
		await fireEvent.press(screen.getByLabelText("Delete note"));

		await waitFor(() => expect(deleteNote).toHaveBeenCalledWith("today-1"));
		expect(router.back).toHaveBeenCalledTimes(1);
	});

	it("says so when the note has been deleted from elsewhere", async () => {
		const screen = await editor({
			loadNote: jest.fn(async () => null),
			updateNote: jest.fn(),
			deleteNote: jest.fn(),
		});

		expect(await screen.findByText("This note is no longer here")).toBeTruthy();
	});
});
