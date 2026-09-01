import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet as NativeStyleSheet } from "react-native";
import { AppText } from "./app-text";
import { ModalSheet } from "./modal-sheet.web";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

describe("ModalSheet on web", () => {
	it("renders a capped dialog and closes from its backdrop", async () => {
		const onClose = jest.fn();
		const view = await render(
			<ModalSheet
				visible
				onClose={onClose}
				closeAccessibilityLabel="Close sheet"
			>
				<AppText>Web sheet content</AppText>
			</ModalSheet>,
		);

		expect(view.getByText("Web sheet content")).toBeTruthy();
		const sheet = view.getByTestId("modal-sheet-web");
		expect(sheet.props.role).toBe("dialog");
		expect(
			NativeStyleSheet.flatten(sheet.props.style).maxHeight,
		).toBeGreaterThan(0);

		fireEvent.press(view.getByLabelText("Close sheet"));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not mount while hidden", async () => {
		const view = await render(
			<ModalSheet
				visible={false}
				onClose={jest.fn()}
				closeAccessibilityLabel="Close sheet"
			>
				<AppText>Hidden content</AppText>
			</ModalSheet>,
		);

		expect(view.queryByTestId("modal-sheet-web")).toBeNull();
	});
});
