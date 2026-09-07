import { fireEvent, render, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { StyleSheet as NativeStyleSheet, Text, View } from "react-native";
import { LogDateProvider, useSetLogDate } from "./log-date-context";
import { TabScreen } from "./tab-screen";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

function SelectedDays({ intakeDay }: { intakeDay: string }) {
	useSetLogDate("journal", "2026-09-02");
	useSetLogDate("intake", intakeDay);
	return null;
}

describe("TabScreen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("keeps mounted tab headers independent of the global route and each other's dates", async () => {
		function Tabs({ intakeDay }: { intakeDay: string }) {
			return (
				<LogDateProvider>
					<SelectedDays intakeDay={intakeDay} />
					<View testID="journal">
						<TabScreen tab="journal">
							<Text>Journal content</Text>
						</TabScreen>
					</View>
					<View testID="intake">
						<TabScreen tab="intake">
							<Text>Intake content</Text>
						</TabScreen>
					</View>
				</LogDateProvider>
			);
		}
		const screen = await render(<Tabs intakeDay="2026-09-01" />);
		const journal = within(screen.getByTestId("journal"));
		const intake = within(screen.getByTestId("intake"));

		expect(journal.getByText("A moment for yourself.")).toBeTruthy();
		expect(journal.getByText("Wednesday, September 2")).toBeTruthy();
		expect(journal.getByText("Journal content")).toBeTruthy();
		expect(journal.queryByLabelText("Settings")).toBeNull();
		expect(intake.getByText("What you’ve had.")).toBeTruthy();
		expect(intake.getByText("Tuesday, September 1")).toBeTruthy();
		expect(intake.getByText("Intake content")).toBeTruthy();
		expect(intake.queryByLabelText("Open insights")).toBeNull();
		expect(intake.queryByLabelText("Open history")).toBeNull();

		await fireEvent.press(journal.getByLabelText("Open insights"));
		expect(router.push).toHaveBeenLastCalledWith("/insights");
		await fireEvent.press(journal.getByLabelText("Open history"));
		expect(router.push).toHaveBeenLastCalledWith("/history");
		await fireEvent.press(intake.getByLabelText("Settings"));
		expect(router.push).toHaveBeenLastCalledWith("/settings");

		await screen.rerender(<Tabs intakeDay="2026-08-31" />);
		expect(journal.getByText("Wednesday, September 2")).toBeTruthy();
		expect(intake.getByText("Monday, August 31")).toBeTruthy();
	});

	it.each([
		["body", "Your body, over time."],
		["life", "Life"],
	] as const)("renders the %s header with settings", async (tab, title) => {
		const screen = await render(
			<TabScreen tab={tab}>
				<Text>Content</Text>
			</TabScreen>,
		);
		expect(screen.getByText(title)).toBeTruthy();
		expect(screen.getByLabelText("Settings")).toBeTruthy();
		expect(screen.queryByLabelText("Open insights")).toBeNull();
	});

	it.each([
		["journal", "Open insights", "insights-header-icon"],
		["intake", "Settings", "settings-header-icon"],
	] as const)(
		"preserves header action sizing on %s",
		async (tab, label, icon) => {
			const screen = await render(
				<TabScreen tab={tab}>
					<Text>Content</Text>
				</TabScreen>,
			);
			expect(
				NativeStyleSheet.flatten(screen.getByLabelText(label).props.style),
			).toMatchObject({ width: 48, height: 48 });
			expect(
				NativeStyleSheet.flatten(screen.getByTestId(icon).parent?.props.style),
			).toMatchObject({
				width: 40,
				height: 40,
				borderRadius: 20,
				borderWidth: 0,
			});
		},
	);
});
