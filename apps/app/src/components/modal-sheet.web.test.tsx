import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet as NativeStyleSheet } from "react-native";
import { AppText } from "./app-text";
import { ModalSheet } from "./modal-sheet.web";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

describe("ModalSheet on web", () => {
	it("keeps an expanded sheet at the same height when its results shrink", async () => {
		const props = {
			visible: true,
			sizing: "expanded" as const,
			onClose: jest.fn(),
			closeAccessibilityLabel: "Close sheet",
		};
		const view = await render(
			<ModalSheet {...props}>
				{Array.from({ length: 12 }, (_, index) => (
					<AppText key={index}>Portion {index}</AppText>
				))}
			</ModalSheet>,
		);
		const initialStyle = NativeStyleSheet.flatten(
			view.getByTestId("modal-sheet-web").props.style,
		);
		expect(initialStyle.height).toBeGreaterThan(0);
		expect(initialStyle.height).toBe(initialStyle.maxHeight);
		await view.rerender(
			<ModalSheet {...props}>
				<AppText>Add custom portion</AppText>
			</ModalSheet>,
		);
		expect(
			NativeStyleSheet.flatten(view.getByTestId("modal-sheet-web").props.style)
				.height,
		).toBe(initialStyle.height);
	});

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
