import { render } from "@testing-library/react-native";
import type {
	LinkPressEvent,
	MarkdownStyle,
} from "react-native-enriched-markdown";
import { MarkdownText } from "./markdown-text";

let mockMarkdownStyle: MarkdownStyle | undefined;
let mockOnLinkPress: ((event: LinkPressEvent) => void) | undefined;

jest.mock("react-native-enriched-markdown", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const shipped = jest.requireActual<
		typeof import("react-native-enriched-markdown")
	>("react-native-enriched-markdown/jest");
	return {
		...shipped,
		EnrichedMarkdownText: ({
			markdownStyle,
			onLinkPress,
			...props
		}: React.ComponentProps<typeof shipped.EnrichedMarkdownText>) => {
			mockMarkdownStyle = markdownStyle;
			mockOnLinkPress = onLinkPress;
			return React.createElement(shipped.EnrichedMarkdownText, props);
		},
	};
});

describe("MarkdownText", () => {
	beforeEach(() => {
		mockMarkdownStyle = undefined;
		mockOnLinkPress = undefined;
	});

	it("uses the editor's continuous block rhythm", async () => {
		await render(<MarkdownText markdown={"First\n\n- One\n- Two"} />);

		expect(mockMarkdownStyle?.paragraph).toMatchObject({
			marginTop: 0,
			marginBottom: 0,
		});
		expect(mockMarkdownStyle?.list).toMatchObject({
			marginTop: 0,
			marginBottom: 0,
		});
	});

	it("reports the URL when a rendered link is pressed", async () => {
		const onLinkPress = jest.fn();
		await render(
			<MarkdownText
				markdown="[bro](https://example.com)"
				onLinkPress={onLinkPress}
			/>,
		);

		mockOnLinkPress?.({ url: "https://example.com" });

		expect(onLinkPress).toHaveBeenCalledWith("https://example.com");
	});
});
