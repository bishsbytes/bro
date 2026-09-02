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
		editA11y: "Edit notes for {{day}}",
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
} as const;
