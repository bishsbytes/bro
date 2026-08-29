import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet as NativeStyleSheet, Text } from "react-native";
import { AppHeader } from "./app-header";
import { AvatarIdentityContext } from "./avatar-identity-context";

describe("AppHeader", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders a title and actions and opens Account from the shared avatar", async () => {
		const onAvatarPress = jest.fn();
		const screen = await render(
			<AppHeader
				title="Today"
				centerTitle
				leading={<Text>History</Text>}
				actions={<Text>Filter</Text>}
				onAvatarPress={onAvatarPress}
			/>,
		);

		expect(screen.getByText("Today")).toBeTruthy();
		expect(screen.getByText("History")).toBeTruthy();
		expect(screen.getByText("Filter")).toBeTruthy();
		expect(
			NativeStyleSheet.flatten(screen.getByText("Today").parent?.props.style)
				.pointerEvents,
		).toBe("none");

		await fireEvent.press(screen.getByLabelText("Account"));
		expect(onAvatarPress).toHaveBeenCalledTimes(1);
	});

	it("shows the registered user's initial without owning session loading", async () => {
		const screen = await render(
			<AvatarIdentityContext.Provider value="Ada">
				<AppHeader title="History" />
			</AvatarIdentityContext.Provider>,
		);

		expect(screen.getByLabelText("Account for Ada")).toBeTruthy();
		expect(screen.getByText("A")).toBeTruthy();
	});
});
