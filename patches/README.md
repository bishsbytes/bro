# Native dependency patches

## react-native-screens 4.26.2

`react-native-screens@4.26.2.patch` skips Android header updates when the
screen no longer belongs to a stack. Fabric can update header props after
`removeScreenAt` clears the container but before the closing animation detaches
the view. The original code treats that screen as the top screen and calls
`canNavigateBack()`, which throws and terminates the app.

Confirmed in the connected device's crash log on 2026-09-06 while closing a
note after save or discard. This matches
[upstream issue #4429](https://github.com/software-mansion/react-native-screens/issues/4429)
and applies the same guard as the proposed
[upstream fix #4498](https://github.com/software-mansion/react-native-screens/pull/4498).
Remove the patch when upgrading to a release containing that fix.

pnpm applies this patch during installation. It changes Kotlin, so an Android
rebuild is required; a JavaScript reload or OTA update is insufficient.

Device regression checks: create and save a note with the keyboard open; create
another and confirm discard; repeat with the keyboard hidden; edit and save an
existing note; use Back with unsaved edits, then confirm discard. Each exit
should return to the previous screen without a new Android crash entry. Check
that saved notes reopen and discarded drafts do not return.
