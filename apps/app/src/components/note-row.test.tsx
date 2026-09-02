import { render } from "@testing-library/react-native";
import { StyleSheet as NativeStyleSheet } from "react-native";
import { lightTheme } from "../theme/unistyles";
import { NoteRow } from "./note-row";

describe("NoteRow", () => {
	it("lists a note directly on the muted canvas with a hairline separator", async () => {
		const screen = await render(
			<NoteRow
				accessibilityLabel="Open note"
				markdown="A thought"
				createdAt={Date.parse("2026-09-02T10:15:00.000Z")}
				updatedAt={Date.parse("2026-09-02T10:15:00.000Z")}
				first
				onPress={jest.fn()}
			/>,
		);

		const style = NativeStyleSheet.flatten(
			screen.getByLabelText("Open note").props.style,
		);
		expect(style).toMatchObject({
			minHeight: lightTheme.control.buttonMinHeight,
			borderTopWidth: 1,
			borderTopColor: lightTheme.colors.line,
			borderBottomWidth: 1,
			borderBottomColor: lightTheme.colors.line,
			backgroundColor: lightTheme.colors.canvas,
		});
		expect(style.borderWidth).toBeUndefined();
		expect(style.borderRadius).toBeUndefined();
		expect(screen.getByTestId("note-row-chevron")).toBeTruthy();
		expect(screen.getByText(/^Added /)).toBeTruthy();
		expect(
			NativeStyleSheet.flatten(screen.getByText("A thought").props.style),
		).toMatchObject({
			height: lightTheme.typography.lead.lineHeight * 2 + lightTheme.spacing.xs,
			overflow: "hidden",
		});
	});

	it("keeps the bottom boundary after the final note", async () => {
		const screen = await render(
			<NoteRow
				accessibilityLabel="Open final note"
				markdown="Last thought"
				createdAt={Date.parse("2026-09-02T10:15:00.000Z")}
				updatedAt={Date.parse("2026-09-02T11:30:00.000Z")}
				onPress={jest.fn()}
			/>,
		);

		expect(
			NativeStyleSheet.flatten(
				screen.getByLabelText("Open final note").props.style,
			).borderBottomWidth,
		).toBe(1);
		expect(
			NativeStyleSheet.flatten(
				screen.getByLabelText("Open final note").props.style,
			).borderTopWidth,
		).toBeUndefined();
		expect(screen.getByText(/^Edited /)).toBeTruthy();
	});
});
