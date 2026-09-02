export const notes = {
	loadFailed: "Your notes could not be loaded",
	empty: {
		title: "No notes yet",
		body: "Notes you add from the journal or log menu will appear here by date.",
	},
	actions: {
		add: "Add note",
		viewAll: "View all",
		showOlder: "Show older notes",
		/** On a note's own card, where the day it belongs to is already on screen. */
		open: "Open note",
		/** In a list that spans days, where the day tells two notes apart. */
		openA11y: "Open note from {{day}}",
	},
	journal: {
		title: "Notes",
		emptyTitle: "What's on your mind?",
		emptyBody: "There is no note for this day.",
	},
	new: {
		day: "Day",
		prompt: "What's on your mind?",
		field: "Note",
		save: "Save note",
		emptyBody: "Write something before saving.",
		discard: "Discard",
		discardPrompt: "Discard this note?",
		keepWriting: "Keep writing",
	},
	edit: {
		field: "Note",
		prompt: "What's on your mind?",
		save: "Save note",
		emptyBody: "A note cannot be left empty.",
		delete: "Delete note",
		deletePrompt: "Delete this note?",
		keepNote: "Keep note",
		/** The note was deleted before this screen could open it. */
		missing: "This note is no longer here",
		missingBody: "It has been deleted.",
		loadFailed: "This note could not be opened",
	},
} as const;
