// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { resolveBottomSheetKeyboardInset } from './bottomActionSheetKeyboard';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const bottomSheet = source('./BottomActionSheet.tsx');
const textInput = source('./TextInput.tsx');
const screen = source('./Screen.tsx');
const watchlistPage = source('../watchlists/WatchlistDetailLayout.tsx');
const sharedWatchlist = source('../watchlists/SharedWatchlistScreen.tsx');
const opinionSheet = source('../opinions/OpinionSheet.tsx');
const addToWatchlist = source('../watchlists/AddToWatchlistControl.tsx');
const library = source('../library/LibraryScreen.tsx');
const settings = source('../profile/SettingsScreen.tsx');
const onboarding = source('../onboarding/OnboardingScreen.tsx');
const explore = source('../catalogue/ExploreScreen.tsx');

const dockedKeyboardInset = resolveBottomSheetKeyboardInset(
  {
    height: 312.3809509277344,
    screenY: 577.90478515625,
    width: 411.4285583496094,
  },
  {
    height: 914.2857142857143,
    width: 411.42857142857144,
  },
);

assert.ok(
  Math.abs(dockedKeyboardInset - 336.3809291294643) < 0.001,
  'a full-width Android keyboard above the navigation bar must move the sheet footer',
);
assert.equal(
  resolveBottomSheetKeyboardInset(
    { height: 300, screenY: 420, width: 330 },
    { height: 914, width: 411 },
  ),
  0,
  'a floating keyboard must not move the full sheet',
);

for (const [name, layout] of [
  ['standard screens', screen],
  ['watchlist screens', watchlistPage],
] as const) {
  assert.match(layout, /<KeyboardAvoidingView\b/, `${name} must resize around the keyboard`);
  assert.match(
    layout,
    /automaticallyAdjustKeyboardInsets/,
    `${name} must keep focused fields inside the visible scroll area`,
  );
}

assert.doesNotMatch(
  bottomSheet,
  /KeyboardAvoidingView/,
  'bottom sheets must not add a delayed keyboard animation on top of the native keyboard',
);
assert.match(
  bottomSheet,
  /keyboardWillChangeFrame/,
  'bottom sheets must react before the iOS keyboard animation starts',
);
assert.match(
  bottomSheet,
  /Keyboard\.scheduleLayoutAnimation\(event\)/,
  'bottom-sheet layout changes must use the native keyboard timing',
);
assert.match(
  bottomSheet,
  /style=\{\[styles\.keyboardFrame, \{ bottom: keyboardInset \}\]\}/,
  'the full bottom-sheet frame, including its footer, must stop above the keyboard',
);
assert.match(
  bottomSheet,
  /automaticallyAdjustKeyboardInsets = false/,
  'bottom-sheet scroll content must not apply the keyboard inset a second time',
);
assert.match(
  bottomSheet,
  /\{footer \? <View style=\{styles\.footer\}>\{footer\}<\/View> : null\}/,
  'bottom-sheet validation actions must render inside the keyboard-synchronized frame',
);
assert.match(
  textInput,
  /onSubmitEditing=\{onSubmitEditing \?\? \(dismissesKeyboardOnSubmit \? Keyboard\.dismiss : undefined\)\}/,
  'single-line fields must dismiss the keyboard from its return key by default',
);
assert.match(
  textInput,
  /returnKeyType=\{returnKeyType \?\? \(multiline \? undefined : 'done'\)\}/,
  'single-line fields must expose a Done return key by default',
);
assert.match(
  textInput,
  /textAlignVertical=\{multiline \? 'top' : 'center'\}/,
  'shared fields must center single-line text and keep multiline text at the top',
);
assert.match(
  textInput,
  /fontSize: typography\.body\.fontSize,[\s\S]*letterSpacing: typography\.body\.letterSpacing,[\s\S]*inputMultiline: \{[\s\S]*lineHeight: typography\.body\.lineHeight/,
  'shared fields must reserve the body line height for multiline editing',
);
assert.match(
  explore,
  /<NativeTextInput[\s\S]*style=\{styles\.searchInput\}[\s\S]*textAlignVertical="center"/,
  'catalogue search text must stay vertically centered',
);
assert.match(
  addToWatchlist,
  /accessibilityLabel="New watchlist name"[\s\S]*style=\{styles\.createInput\}[\s\S]*textAlignVertical="center"/,
  'the native watchlist name field must keep its text vertically centered',
);
assert.match(
  sharedWatchlist,
  /const memberForm = watchlist\.isOwner \? \([\s\S]*<TextInput[\s\S]*value=\{memberUserId\}[\s\S]*<Button[\s\S]*label="Add member"/,
  'the member field and validation action must stay together',
);
assert.match(
  sharedWatchlist,
  /<BottomActionSheet\s+footer=\{memberForm\}[\s\S]*title="Members"/,
  'member controls must use the keyboard-synchronized sheet footer',
);
assert.match(
  sharedWatchlist,
  /footer=\{isVoteComposerOpen \? \([\s\S]*label="Create vote"/,
  'vote creation must stay above the keyboard',
);
assert.match(opinionSheet, /footer=\{sheetFooter\}/, 'opinion save actions must use the sheet footer');
assert.match(addToWatchlist, /<BottomActionSheet footer=\{footer\}/, 'watchlist actions must use the sheet footer');
assert.match(library, /footer=\{createListFooter\}/, 'list creation must use the screen footer');
assert.match(
  settings,
  /footer=\{isDirty \|\| status === 'saving' \? \([\s\S]*label="Save changes"/,
  'settings save must use the screen footer only while changes are pending',
);
assert.match(
  onboarding,
  /footer=\{\s*isProfileEditing \? undefined : \([\s\S]*<OnboardingFooter/,
  'onboarding actions must use the screen footer',
);
assert.match(
  screen,
  /nativeKeyboardInsetsOnly\?: boolean/,
  'forms that use a native input accessory must be able to opt out of KeyboardAvoidingView padding',
);
assert.match(
  screen,
  /behavior=\{!nativeKeyboardInsetsOnly && Platform\.OS === 'ios' \? 'padding' : undefined\}/,
  'native keyboard inset screens must not stack KeyboardAvoidingView padding',
);
assert.match(
  onboarding,
  /<InputAccessoryView nativeID=\{ONBOARDING_INPUT_ACCESSORY_ID\}>[\s\S]*accessibilityLabel="Dismiss keyboard"[\s\S]*Keyboard\.dismiss/,
  'onboarding must use a native keyboard accessory for its compact dismiss control',
);
assert.match(
  onboarding,
  /inputAccessoryViewID=\{ONBOARDING_INPUT_ACCESSORY_ID\}[\s\S]*onFocus=\{onFieldFocus\}/,
  'onboarding profile fields must attach to the native accessory before the keyboard animates',
);
assert.match(
  onboarding,
  /scrollResponderScrollNativeHandleToKeyboard\([\s\S]*event\.target,[\s\S]*ONBOARDING_KEYBOARD_ACCESSORY_HEIGHT \+ spacing\.xl \+ ONBOARDING_KEYBOARD_FIELD_GAP/,
  'the focused onboarding field must animate to the edge of the keyboard accessory',
);
assert.match(
  onboarding,
  /const ONBOARDING_KEYBOARD_FIELD_GAP = 200 \/ PixelRatio\.get\(\)/,
  'the onboarding field must keep a 200 physical-pixel gap above the keyboard accessory',
);
assert.match(
  onboarding,
  /footer=\{\s*isProfileEditing \? undefined : \(/,
  'onboarding must hide its large action footer as soon as a profile field receives focus',
);
assert.doesNotMatch(
  onboarding,
  /<ScrollView\s*\n/,
  'onboarding must let Screen own keyboard-aware scrolling instead of nesting a second scroller',
);
assert.match(explore, /automaticallyAdjustKeyboardInsets/, 'catalogue search must adjust around the keyboard');

console.log('Keyboard avoidance QA passed.');
