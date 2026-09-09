# App components

Components in this directory are app-local building blocks extracted from UI
that at least two screens already share.

Follow the [design rulebook](../../../../design/DESIGN.md) and
[native component contracts](../../../../design/REACT_NATIVE.md#component-contracts)
for surfaces, borders, button variants, typography, segmented controls and lists.
Those contracts also record intentional differences, including the decorative
action cue inside a tappable Journal check-in card.

- Style only with tokens from `theme/unistyles.ts`; do not add hardcoded colour
  values.
- Extract to remove demonstrated duplication, not to predict future screens.
- Keep product and data behavior in screens or feature stores. Components own
  presentation and generic interaction behavior only.
- Add focused tests for behavior a component owns, such as disabled buttons or
  field errors. Screen and flow tests remain responsible for product behavior.
