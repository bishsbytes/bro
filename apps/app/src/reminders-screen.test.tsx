import type { Reminder } from "@bro/database-app";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { RemindersScreen } from "./screens/settings/reminders-screen";

jest.mock("expo-router", () => ({
	useFocusEffect: (effect: () => void | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

function reminder(overrides: Partial<Reminder> = {}): Reminder {
	return {
		id: "reminder-1",
		minuteOfDay: 20 * 60,
		daysOfWeek: 0b111_1111,
		enabled: true,
		createdAt: 1,
		updatedAt: 1,
		...overrides,
	};
}

describe("reminders screen", () => {
	it("creates and persists the default every-day reminder", async () => {
		let rows: Reminder[] = [];
		const store = {
			load: jest.fn(async () => ({
				reminders: rows,
				permission: "granted" as const,
			})),
			create: jest.fn(async (schedule) => {
				const created = reminder(schedule);
				rows = [created];
				return created;
			}),
			update: jest.fn(async () => undefined),
			setEnabled: jest.fn(async () => undefined),
			delete: jest.fn(async () => undefined),
		};
		const view = await render(<RemindersScreen store={store} />);

		await waitFor(() =>
			expect(view.getByText("No reminders yet")).toBeTruthy(),
		);
		await fireEvent.press(view.getByText("Add reminder"));
		expect(view.getByLabelText("Time (24-hour)").props.value).toBe("20:00");
		await fireEvent.press(view.getByText("Save reminder"));

		await waitFor(() =>
			expect(store.create).toHaveBeenCalledWith({
				minuteOfDay: 1_200,
				daysOfWeek: 0b111_1111,
			}),
		);
		await waitFor(() => expect(view.getByText("Every day")).toBeTruthy());
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("keeps denied schedules visible and points to system settings", async () => {
		const store = {
			load: jest.fn(async () => ({
				reminders: [reminder()],
				permission: "denied" as const,
			})),
			create: jest.fn(),
			update: jest.fn(),
			setEnabled: jest.fn(async () => undefined),
			delete: jest.fn(),
		};
		const view = await render(<RemindersScreen store={store} />);

		await waitFor(() =>
			expect(view.getByText("Notifications are off")).toBeTruthy(),
		);
		expect(view.getByText("20:00")).toBeTruthy();
		expect(view.getByText("Open system settings")).toBeTruthy();

		await fireEvent(
			view.getByLabelText("Disable 20:00 reminder"),
			"valueChange",
			false,
		);
		await waitFor(() =>
			expect(store.setEnabled).toHaveBeenCalledWith("reminder-1", false),
		);
	});
});
