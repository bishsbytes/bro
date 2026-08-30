import { fireEvent, render } from "@testing-library/react-native";
import { AppText } from "./app-text";
import { ModalSheet } from "./modal-sheet";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

describe("ModalSheet", () => {
	it("uses dynamic sizing, a fading backdrop, and every close path", async () => {
		const onClose = jest.fn();
		const view = await render(
			<ModalSheet
				visible
				onClose={onClose}
				closeAccessibilityLabel="Close sheet"
			>
				<AppText>Sheet content</AppText>
			</ModalSheet>,
		);

		expect(view.getByText("Sheet content")).toBeTruthy();
		const sheet = view.getByTestId("bottom-sheet");
		expect(sheet.props.enableDynamicSizing).toBe(true);
		expect(sheet.props.maxDynamicContentSize).toBeGreaterThan(0);
		expect(sheet.props.snapPoints).toEqual(["90%"]);
		const backdrop = view.getByTestId("modal-sheet-backdrop", {
			includeHiddenElements: true,
		});
		expect(backdrop.props.appearsOnIndex).toBe(0);
		expect(backdrop.props.disappearsOnIndex).toBe(-1);
		expect(backdrop.props.opacity).toBe(1);

		await fireEvent.press(backdrop);
		fireEvent(view.getByText("Sheet content"), "requestClose");

		expect(onClose).toHaveBeenCalledTimes(2);
	});
});
