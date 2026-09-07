import { fireEvent, render } from "@testing-library/react-native";
import { MarkdownField } from "./markdown-field.web";

// The library's real web entry provides a renderer, but no text input.
jest.mock("react-native-enriched-markdown", () => ({}));

describe("MarkdownField on web", () => {
	it("edits markdown without requiring a native editor", async () => {
		const onChangeMarkdown = jest.fn();
		const screen = await render(
			<MarkdownField
				label="Note"
				defaultValue="**Existing** note"
				onChangeMarkdown={onChangeMarkdown}
			/>,
		);
		expect(screen.getByDisplayValue("**Existing** note")).toBeTruthy();
		await fireEvent.changeText(
			screen.getByLabelText("Note"),
			"**Existing** note\n- More context",
		);
		expect(onChangeMarkdown).toHaveBeenCalledWith(
			"**Existing** note\n- More context",
		);
	});
});
