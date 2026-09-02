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

describe("notes screens", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("lists all notes under their days, newest day first", async () => {
		const screen = await render(
			<NotesScreen
				now={FIXED_NOW}
				store={{
					listNotes: jest.fn(async () => [
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
					]),
				}}
			/>,
		);

		expect(await screen.findByText("Today")).toBeTruthy();
		expect(screen.getByText("Yesterday")).toBeTruthy();
		expect(screen.getByText("The first thought")).toBeTruthy();
		expect(screen.getByText("The second thought")).toBeTruthy();
		expect(screen.getByText("An older thought")).toBeTruthy();
	});

	it("offers the composer when there are no notes", async () => {
		const screen = await render(
			<NotesScreen
				now={FIXED_NOW}
				store={{ listNotes: jest.fn(async () => []) }}
			/>,
		);

		await fireEvent.press(await screen.findByText("Add note"));
		expect(router.push).toHaveBeenCalledWith("/notes/new");
	});

	it("creates a note for the selected journal day", async () => {
		const createNote = jest.fn(async () => null);
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
});
