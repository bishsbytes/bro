# Journal and check-ins refinement

Reference: [J01–J04, PDF pages 4–5](mens-health-design-guide.pdf), the component specimens on pages 12–14, and the current [native contracts](REACT_NATIVE.md).

| Study | Refinement |
| --- | --- |
| Shared canvas and header | Off-white canvas with darker warm stone surfaces in light appearance. App headers use 24-point horizontal and 8-point vertical padding within the safe area; check-in headers use 24-point horizontal, 16-point top and 12-point bottom insets. Editorial titles use the full width below the date/action row. |
| J01 Journal | Full-width serif title below the selected date; separate date tiles and recording dots; one prominent invitation for the current sitting and a compact second sitting. Saved cards lead with actual answers, partial/complete status, event date/time and source. Factors and notes precede habit/review prompts. |
| J01 Factors | Tighter Body, Lifestyle and Mind groups, trailing selection checkmarks and a left-aligned More factors action. Additional categories remain available in More factors; selected factors remain visible when collapsed. Confirming unselected factors as absent still requires exposing the entire list. |
| J02 Mood | Full sitting name, question heading, compact progress header with the current step highlighted, five equal options, optional-note entry and fixed save actions. Fresh answers remain unselected. |
| J03 Energy | The same layout, with the full question and the existing endpoint meanings attached to their numeric rows. Continue preserves the draft; Save for now retains partial-save behavior. |
| J04 Motivation | The full question, named-answer summary, explicit unanswered dimensions and Back to the previous score once all dimensions are answered. The question/answers scroll independently of the footer on short screens. |

## Product mappings

- The whole check-in card is tappable. The featured card's stone-filled “Check in” cue belongs to the card; it is not a secondary button or a separate accessibility action.
- The existing five-point Energy and Motivation scales remain numeric. The board's fictional intermediate descriptions do not reinterpret recorded values. Configured optional dimensions still determine the flow length and invitation copy.
- Notes remain separate journal records. The optional-note row opens the existing dated editor while retaining check-in answers. On web, a multiline Markdown editor replaces the unavailable native rich-text input; native editing is unchanged.
- The Journal date still opens History, and Insights remains available. Native tabs retain their platform behavior, with a book symbol for Journal. Page gutters, readable controls and minimum touch areas take precedence over the raster board's smaller controls; narrow calendars wrap.
- Existing dates, routes, record identities, scale snapshots and atomic check-in writes are retained. No example answers or new product defaults are introduced.

## Validation

The review includes browser checks of both appearances, the three check-in steps, draft recovery, note save/return, partial-save metadata and short/narrow viewports, plus app/database-app tests, app typecheck/lint and repo-wide Biome. Browser score, date, factor and disabled-button states are explicit; selection was verified in the rendered radio group. Enlarged browser text was also checked with the footer visible.

Native Dynamic Type, VoiceOver/TalkBack and real-device keyboard/sheet behavior remain device release checks; browser inspection does not establish those results.
