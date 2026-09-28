# Native header sizing and touch fix

Reported on Watchly 1.0.0, TestFlight build 15, iOS 27. EAS confirms build
`fadd1c74-1c3e-49b6-99ce-f02f0a173725` was built from `3fe886e` with the
same header implementation and `react-native-screens` 4.16.0 as this checkout.

The existing dependency patch now includes a focused native backport:

- On iOS 26 and later, center left/right React content inside the native bar
  item and constrain it to its intrinsic size, including compression resistance.
- Convert the subview's local bounds to navigation-bar coordinates for Fabric
  touch handling. Passing its frame counted the position twice.
- Reuse unchanged bar items across header updates without retaining an item
  from its own content view.
- Preserve wrapper dimensions when replacing content with a transition snapshot.

The native Liquid Glass appearance, back action, edge swipe, and favorite
mutation are retained. The existing bottom-tab icon patch is retained too.

Sources:

- [Merged sizing and coordinate fix, #3449](https://github.com/software-mansion/react-native-screens/pull/3449)
- [Merged compression-resistance fix, #3548](https://github.com/software-mansion/react-native-screens/pull/3548)
- [Snapshot constraint fix proposal, #4360](https://github.com/software-mansion/react-native-screens/issues/4360)

This is an adaptation to 4.16.0, not an upgrade of the navigation library.
The snapshot proposal is not an upstream merged release. Installed-source QA
checks patch application and the existing direct-back action; it cannot verify
UIKit layout or physical-device touch handling.

## Device acceptance

A new native iOS build is required. A Metro reload or JavaScript update cannot
change build 15's compiled navigation code.

On the affected iOS 27 phone:

1. Open a film from Profile, toggle favorite on/off, then use the back button.
   Repeat at least ten times, including a series and a long origin label.
2. Repeat with completed and cancelled edge-swipe returns. Check both buttons
   immediately afterward, including while the favorite request is pending.
3. Check favorite state after reopening, and ensure its watched status remains.
4. Check headers with multiple actions (watchlists) and the profile genre filter.
5. Verify that glass remains compact, text stays inside its button, and tapping
   each visible control activates only that control.

Native compilation and device acceptance must be recorded separately from
TypeScript and installed-source QA. Physical iPhone acceptance is still pending.
