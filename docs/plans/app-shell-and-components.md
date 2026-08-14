# App shell and shared components plan

## Status

Draft, 14 August 2026. Infrastructure between [step 1](step-1-check-in.md) and [step 2](step-2-reminders.md), not a product-sequencing step: native tab navigation, native stack headers, and a first shared component layer extracted from the eight screens that exist. Step 2's reminders UI (its slice 4) builds on this shell, so this lands first. Decisions here were taken with Nick on 14 August 2026: four tabs, native tabs, native headers, components in-app.

## Why now

Eight screens totalling ~2,100 lines share zero components — there is no `components/` directory. Every screen hand-draws its buttons (80 `TouchableOpacity` usages), five screens hand-roll a "Back" button, and each builds headers, section titles, and card surfaces from raw `View`/`Text`. Navigation is a single `Stack` with `headerShown: false`, so History, Trends, and Settings are pushed screens dangling off links on Today. The token layer below all this is solid — parity-tested light/dark themes in `src/theme/unistyles.ts` — and is not the subject; this is the layer between tokens and screens. Step 2 adds a settings child route and step 3 adds assessment screens; every screen written before the shell exists is another screen to retrofit.

## Decisions taken

- **Four bottom tabs: Today (`/`), History, Trends, Settings.** The top-level surfaces stop being pushed screens. Settings as a tab gives step 2's reminders screen and the existing delete-local-data flow a stable home, and the account entry point moves from Today into Settings where it belongs once a settings surface is first-class. Later steps that add surfaces (the wheel, habits) revisit the tab set deliberately rather than growing it by default.
- **Native tabs, not JavaScript tabs**: expo-router's NativeTabs — a real `UITabBarController` / Material bottom navigation, not a drawn imitation. It rides on `react-native-screens`, already a dependency, so **no new native module and no prebuild regeneration** — this can ship before step 2's. The API surface and import path must be verified against the installed expo-router's docs (SDK 56), not memory: it shipped as unstable and its stability status, styling hooks, and jest behaviour are exactly what slice 1's spike confirms. **Fallback, only if the spike fails hard:** classic JS `Tabs` behind the same route structure, recorded as a revisit — the route tree is identical either way, so the swap stays cheap.
- **Native stack headers** (`headerShown: true`) everywhere below the tabs: platform back buttons and gestures for free, the five hand-rolled Back buttons deleted. Header colours come from theme tokens. Whether Today shows a header title or owns its top area stays an implementation-time call for that one screen; every pushed screen gets one.
- **Components live in `apps/app/src/components/`**, not a workspace package. One app exists; `packages/ui` is structure without a second consumer, and promotion later is mechanical.
- **Extraction, not redesign.** Every component is pulled from what at least two screens already draw, and screens must look the same after the refactor as before it. Visual change is a different conversation with product stakes; mixing it into a structural refactor would make both unreviewable.
- **Token discipline is unchanged**: components style exclusively from `unistyles.ts` tokens, and the token-parity test keeps covering any token the shell adds (tab bar and header colours included).

## Route restructure

```
src/app/
  _layout.tsx            — root Stack: startup, providers, guards; hosts (tabs), account, sign-in, sign-up, onboarding
  (tabs)/
    _layout.tsx          — NativeTabs: index, history, trends, settings
    index.tsx            — Today
    history/
      _layout.tsx        — Stack, native headers
      index.tsx
      [localDay].tsx
    trends.tsx
    settings/
      _layout.tsx        — Stack, native headers
      index.tsx          — menu: account entry, reminders (step 2), delete local data
      (step 2 adds reminders.tsx here)
```

Group segments do not appear in pathnames, so `/`, `/history`, `/history/[localDay]`, `/trends`, and `/settings` all resolve unchanged — the router tests' pathname assertions survive the move. `Stack.Protected` guards move from six individual screens to the `(tabs)` group plus `account`; `sign-in`/`sign-up`/`onboarding` stay where they are. `/account` remains a root-stack route; only its entry point moves from Today to Settings.

## Component set

Extracted, with the screens that currently duplicate them:

| Component | Replaces |
| --- | --- |
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

### Slice 2: Route restructure and native headers

1. Move routes into the structure above; guards to the group; per-tab stacks with native headers themed from tokens.
2. Delete the five hand-rolled Back buttons and each screen's header scaffolding; move the account entry point to the settings menu.
3. Router tests updated where they pressed hand-rolled "Back" text — navigation in tests drives the router (or platform back) rather than header internals, since native-stack header buttons may not render as reachable text under jest. Pathname assertions stay as they are.
4. Both colour schemes verified for tab bar and headers; new tokens join the parity test.

### Slice 3: Component extraction

1. Add the eight components; refactor all eight screens to use them, like-for-like.
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

- Four native tabs on device, native headers on every pushed screen, no hand-rolled back affordances left.
- All eight screens composed from shared components with no visual redesign; the two shared style files dissolved or reduced to local remainders.
- Router tests green with unchanged pathname assertions; token parity holds; no hardcoded colours in the new layer.
- The NativeTabs-under-jest question answered in writing (this document), whichever way it went.
- Step 2's reminders UI can be built entirely from `Screen`, `ListRow`, `Button`, `FormField`, and the settings stack — the proof is that its slice 4 starts with no new scaffolding.
