# App components

Components in this directory are app-local building blocks extracted from UI
that at least two screens already share.

- Style only with tokens from `theme/unistyles.ts`; do not add hardcoded colour
  values.
- Extract to remove demonstrated duplication, not to predict future screens.
- Keep product and data behavior in screens or feature stores. Components own
  presentation and generic interaction behavior only.
- Add focused tests for behavior a component owns, such as disabled buttons or
  field errors. Screen and flow tests remain responsible for product behavior.
