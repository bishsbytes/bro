# App shell and shared components plan

## Status

In progress, 14 August 2026. Slices 1 and 2 are implemented with the JS-tabs fallback described below; slice 3 is underway with the shared top-level header and account avatar. Infrastructure between [step 1](step-1-check-in.md) and [step 2](step-2-reminders.md), not a product-sequencing step: tab navigation, native stack headers, and a first shared component layer extracted from the eight screens that exist. Step 2's reminders UI (its slice 4) builds on this shell, so this lands first. Decisions here were taken with Nick on 14 August 2026: four tabs, a common tab-root header, native pushed-screen headers, components in-app.

## Why now

Eight screens totalling ~2,100 lines share zero components — there is no `components/` directory. Every screen hand-draws its buttons (80 `TouchableOpacity` usages), five screens hand-roll a "Back" button, and each builds headers, section titles, and card surfaces from raw `View`/`Text`. Navigation is a single `Stack` with `headerShown: false`, so History, Trends, and Settings are pushed screens dangling off links on Today. The token layer below all this is solid — parity-tested light/dark themes in `src/theme/unistyles.ts` — and is not the subject; this is the layer between tokens and screens. Step 2 adds a settings child route and step 3 adds assessment screens; every screen written before the shell exists is another screen to retrofit.

## Decisions taken

- **Four bottom tabs: Today (`/`), History, Trends, Settings.** The top-level surfaces stop being pushed screens. Settings as a tab gives step 2's reminders screen and the existing delete-local-data flow a stable home; Account remains consistently reachable from the common header avatar. Later steps that add surfaces (the wheel, habits) revisit the tab set deliberately rather than growing it by default.
- **JS tabs for now; revisit NativeTabs**: the SDK 56 package still exports NativeTabs from `expo-router/unstable-native-tabs`, with trigger labels/icons/badges and theme hooks for background, tint, labels, icons, indicator, ripple, and shadow. The real-router spike failed hard under `jest-expo`: NativeTabs eagerly mounted all four route trees, initializing inactive repositories and making screen queries ambiguous (16 failures). The planned classic `Tabs` fallback is therefore active behind the same route structure. NativeTabs remains a contained revisit once its Jest/native-screen behaviour supports isolated routes.
- **One common header across tab roots; native stack headers below them.** `AppHeader` gives Today, History, Trends, and Settings a stable top area containing only the navigation title, actions, and persistent account avatar. Prompts and explanatory copy belong to the page body. The avatar is the Account entry point, showing an initial only when identity is already available and never initiating session work. Every pushed screen uses a native stack header for platform back buttons and gestures; the five hand-rolled Back buttons are deleted. Header colours come from theme tokens.
- **Components live in `apps/app/src/components/`**, not a workspace package. One app exists; `packages/ui` is structure without a second consumer, and promotion later is mechanical.
- **Extraction, not redesign.** Every component is pulled from what at least two screens already draw, and screens must look the same after the refactor as before it. Visual change is a different conversation with product stakes; mixing it into a structural refactor would make both unreviewable.
- **Token discipline is unchanged**: components style exclusively from `unistyles.ts` tokens, and the token-parity test keeps covering any token the shell adds (tab bar and header colours included).

## Route restructure

```
src/app/
  _layout.tsx            — root Stack: startup, providers, guards; hosts (tabs), account, sign-in, sign-up, onboarding
  (tabs)/
    _layout.tsx          — classic Tabs plus the persistent shared AppHeader
    index.tsx            — Today page content
    history/
      _layout.tsx        — Stack, native headers
      index.tsx          — History page content; pushed day uses native header
      [localDay].tsx
    trends.tsx           — Trends page content
    settings/
      _layout.tsx        — Stack, native headers
      index.tsx          — Settings page content; reminders (step 2), delete local data
      (step 2 adds reminders.tsx here)
```

Group segments do not appear in pathnames, so `/`, `/history`, `/history/[localDay]`, `/trends`, and `/settings` all resolve unchanged — the router tests' pathname assertions survive the move. `Stack.Protected` guards move from six individual screens to the `(tabs)` group plus `account`; `sign-in`/`sign-up`/`onboarding` stay where they are. `/account` remains a root-stack route and is opened from the common header avatar.

## Component set

Extracted, with the screens that currently duplicate them:

| Component | Replaces |
| --- | --- |
| `AppHeader` | The stable safe-area header across all four tab roots, with a navigation title and action slots |
| `AvatarButton` | The persistent Account entry point across all tab roots; registered initial or generic profile icon |
| `Screen` | Per-screen safe-area + themed background + scroll/padding scaffold (all eight screens) |
| `AppText` | Raw `Text` styled from `theme.typography` variants everywhere |
| `Button` | Primary/secondary/danger/text `TouchableOpacity` variants, disabled and busy states (auth, settings, check-in, day view) |
| `Card` | The `surface`-coloured rounded container (home, history, trends, account) |
| `ListRow` | Label + chevron/value navigation rows (settings menu, history list) |
| `SectionHeader` | Section titles and eyebrow labels (home, trends, account) |
| `FormField` | Bordered `TextInput` with label and error (auth screens, note field) |
| `EmptyState` | Title + explanation placeholder (history, trends not-enough-data) |

`auth-styles.ts` and `onboarding-styles.ts` — the current sharing mechanism — dissolve into these where they overlap and stay local where they are genuinely screen-specific. Nothing else is built speculatively; a component earns its place by deleting duplication, and the first screen that needs a ninth component adds it then.

## Delivery slices

### Slice 1: NativeTabs spike

1. Confirm against the installed expo-router (SDK 56) docs: the NativeTabs import path and stability status, per-tab icon/label API, badge support, and theming hooks.
2. A branch with the `(tabs)` skeleton over placeholder screens, run under `@bro/app:test`: the real-router tests must still resolve pathnames and drive navigation with NativeTabs mounted under jest-expo.
3. Exit: NativeTabs confirmed, or the JS-Tabs fallback invoked and recorded here. This slice is a day, not a week; its output is a decision, not code to keep.

**Result, 14 August 2026:** fallback invoked. The installed API was verified as described above, but the real-router Jest spike eagerly mounted every tab and failed route isolation. Classic `Tabs` passes the same pathname and tab-navigation coverage without changing the public route tree.

### Slice 2: Route restructure and native headers

1. Move routes into the structure above; guards to the group; per-tab stacks with native headers themed from tokens.
2. Delete the five hand-rolled Back buttons and each screen's header scaffolding; move the account entry point to the settings menu.
3. Router tests updated where they pressed hand-rolled "Back" text — navigation in tests drives the router (or platform back) rather than header internals, since native-stack header buttons may not render as reachable text under jest. Pathname assertions stay as they are.
4. Both colour schemes verified for tab bar and headers; new tokens join the parity test.

### Slice 3: Component extraction

1. Add the ten components; refactor all eight screens to use them, like-for-like. `AppHeader` and `AvatarButton` land first because every tab root consumes them.
2. Existing screen and flow tests are the harness — they pass unmodified except where they queried style-specific internals. No new snapshot layer; behaviour tests already cover these screens.
3. Component-level tests only for behaviour a component owns (Button busy/disabled blocking presses, FormField error rendering) — not appearance.

### Slice 4: Close-out

1. `auth-styles.ts`/`onboarding-styles.ts` dissolved or trimmed to the genuinely local remainder.
2. Repository conventions noted in `apps/app/src/components/README.md`: token-only styling, extraction-not-speculation, where a component must come from before it is added.
3. Step 2's plan note confirmed (its slice 4 builds reminders UI from these components inside the settings stack); this document's status updated.

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Pathnames | `/`, `/history`, `/history/[localDay]`, `/trends`, `/settings` resolve exactly as before the move. |
| Guards | Incomplete onboarding still cannot reach any tab; completion lands on Today. |
| Tab navigation | Each tab reachable and its screen rendered under the real router in jest. |
| Shared header | Every tab root has its configured header and Account avatar; pushed screens do not render it. |
| Back navigation | Day view and settings children return correctly with no hand-rolled Back button present. |
| Account entry | Reachable from Settings; `/account` route unchanged. |
| Like-for-like | Every pre-existing screen/flow test passes after component extraction. |
| Theme parity | Tab bar and header tokens exist in both themes; no hardcoded colour anywhere in `components/`. |
| No behaviour change | Check-in, history editing, trends, delete-local-data flows byte-identical in assertions. |

## Verification commands

```bash
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app --skipNxCache
```

Preserve the complete output of a failing command. A device pass on both colour schemes (tab bar, headers, every refactored screen) joins step 2's native session rather than demanding its own.

## Exit criteria

- Four tabs on device, one shared header/account avatar across tab roots, native headers on every pushed screen, no hand-rolled back affordances left.
- All eight screens composed from shared components with no visual redesign; the two shared style files dissolved or reduced to local remainders.
- Router tests green with unchanged pathname assertions; token parity holds; no hardcoded colours in the new layer.
- The NativeTabs-under-jest question answered in writing (this document), whichever way it went.
- Step 2's reminders UI can be built entirely from `Screen`, `ListRow`, `Button`, `FormField`, and the settings stack — the proof is that its slice 4 starts with no new scaffolding.
