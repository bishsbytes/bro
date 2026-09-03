import { act, fireEvent, render } from "@testing-library/react-native";
import type { RefObject } from "react";
import { StyleSheet } from "react-native";
import type {
	EnrichedMarkdownTextInputInstance,
	StyleState,
} from "react-native-enriched-markdown";
import { MarkdownField } from "./markdown-field";

/**
 * The ref and the style callback of every input the field mounts, in mount
 * order. Formatting is dispatched as native commands and the style under the
 * cursor arrives from native, so neither leaves a rendered trace for the
 * assertions to read.
 */
const mockRefs: Array<RefObject<EnrichedMarkdownTextInputInstance | null>> = [];
const mockReportState: Array<(state: StyleState) => void> = [];

jest.mock("react-native-enriched-markdown", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const shipped = jest.requireActual<
		typeof import("react-native-enriched-markdown")
	>("react-native-enriched-markdown/jest");
	return {
		...shipped,
		// The shipped mock still renders the input and spies its methods; this
		// only notes the ref and the state callback on the way through.
		EnrichedMarkdownTextInput: ({
			ref,
			onChangeState,
			...props
		}: React.ComponentProps<typeof shipped.EnrichedMarkdownTextInput>) => {
			if (ref && !mockRefs.includes(ref)) mockRefs.push(ref);
			if (onChangeState && !mockReportState.includes(onChangeState)) {
				mockReportState.push(onChangeState);
			}
			return React.createElement(shipped.EnrichedMarkdownTextInput, {
				...props,
				ref,
			});
		},
	};
});

/** What the native input reports when the cursor sits in plain prose. */
const PLAIN: StyleState = {
	bold: { isActive: false },
	italic: { isActive: false },
	underline: { isActive: false },
	strikethrough: { isActive: false },
	spoiler: { isActive: false },
	link: { isActive: false },
	heading: { isActive: false, level: 1 },
	unorderedList: { isActive: false, depth: 0 },
	orderedList: { isActive: false, depth: 0 },
};

describe("MarkdownField", () => {
	beforeEach(() => {
		mockRefs.length = 0;
		mockReportState.length = 0;
	});

	it("labels the input and reports what was typed as markdown", async () => {
		const onChangeMarkdown = jest.fn();
		const screen = await render(
			<MarkdownField label="Note" onChangeMarkdown={onChangeMarkdown} />,
		);

		fireEvent.changeText(screen.getByLabelText("Note"), "A thought");

		expect(onChangeMarkdown).toHaveBeenCalledWith("A thought");
	});

	it("keeps the native editor text visible without a density-unsafe line height", async () => {
		const screen = await render(
			<MarkdownField label="Note" onChangeMarkdown={jest.fn()} />,
		);
		const style = StyleSheet.flatten(screen.getByLabelText("Note").props.style);

		expect(style).toMatchObject({
			fontFamily: "InstrumentSerif_400Regular",
			fontSize: 21,
			fontWeight: "400",
			color: expect.stringMatching(/^#/),
		});
		expect(style.lineHeight).toBeUndefined();
	});

	it("opens on the markdown it was given", async () => {
		const screen = await render(
			<MarkdownField
				label="Note"
				defaultValue="**Kept** from before"
				onChangeMarkdown={jest.fn()}
			/>,
		);

		expect(screen.getByDisplayValue("**Kept** from before")).toBeTruthy();
	});

	it("applies each formatting control and shows which are active", async () => {
		const screen = await render(
			<MarkdownField label="Note" onChangeMarkdown={jest.fn()} />,
		);
		const input = mockRefs[0].current;
		if (!input) throw new Error("The field mounted no input to format.");

		fireEvent.press(screen.getByLabelText("Bold"));
		fireEvent.press(screen.getByLabelText("Italic"));
		fireEvent.press(screen.getByLabelText("Bullet list"));

		expect(input.toggleBold).toHaveBeenCalledTimes(1);
		expect(input.toggleItalic).toHaveBeenCalledTimes(1);
		expect(input.toggleUnorderedList).toHaveBeenCalledTimes(1);
		expect(
			screen.getByLabelText("Bold").props.accessibilityState,
		).toMatchObject({ selected: false });

		// Native reports what the cursor is sitting in; the toolbar follows it
		// rather than tracking its own presses.
		await act(async () => {
			mockReportState[0]({ ...PLAIN, bold: { isActive: true } });
		});

		expect(
			screen.getByLabelText("Bold").props.accessibilityState,
		).toMatchObject({ selected: true });
		expect(
			screen.getByLabelText("Italic").props.accessibilityState,
		).toMatchObject({ selected: false });
	});
});
