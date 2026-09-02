import { render } from "@testing-library/react-native";
import type { MarkdownStyle } from "react-native-enriched-markdown";
import { MarkdownText } from "./markdown-text";

let mockMarkdownStyle: MarkdownStyle | undefined;

jest.mock("react-native-enriched-markdown", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const shipped = jest.requireActual<
		typeof import("react-native-enriched-markdown")
	>("react-native-enriched-markdown/jest");
	return {
		...shipped,
		EnrichedMarkdownText: ({
			markdownStyle,
			...props
		}: React.ComponentProps<typeof shipped.EnrichedMarkdownText>) => {
			mockMarkdownStyle = markdownStyle;
			return React.createElement(shipped.EnrichedMarkdownText, props);
		},
	};
});

describe("MarkdownText", () => {
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
});
