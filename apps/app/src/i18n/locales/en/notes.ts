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
		/** On a day screen; the position distinguishes multiple notes for readers. */
		open: "Open note {{position}} of {{count}}",
		/** In a list spanning days; day and position together identify the note. */
		openA11y: "Open note {{position}} of {{count}} from {{day}}",
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
		discardPrompt: "Discard these changes?",
		keepEditing: "Keep editing",
		discardChanges: "Discard changes",
		/** The note was deleted before this screen could open it. */
		missing: "This note is no longer here",
		missingBody: "It has been deleted.",
		loadFailed: "This note could not be opened",
	},
} as const;
