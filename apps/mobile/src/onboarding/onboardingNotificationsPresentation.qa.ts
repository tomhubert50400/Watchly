import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./OnboardingScreen.tsx', import.meta.url), 'utf8');
const footerSource = source.slice(
  source.indexOf('function OnboardingFooter'),
  source.indexOf('function ProfileStep'),
);

assert.match(
  source,
  /nativeKeyboardInsetsOnly[\s\S]*title=""/,
  'every onboarding step must own its heading directly below the progress bars',
);
assert.match(
  source,
  /<Text style=\{styles\.notificationsHeading\}>Stay in the loop<\/Text>/,
  'the notification step must show its approved heading below the progress bars',
);
assert.match(
  source,
  /notificationsHeading: \{\s*\.\.\.typography\.title,\s*color: colors\.accentText,\s*\}/,
  'the notification heading must use the approved pink accent',
);
assert.match(
  source,
  /<NotificationsStep[\s\S]*loading=\{notificationStatus === 'requesting' \|\| isFinishing\}[\s\S]*onEnable=\{\(\) => void allowNotifications\(\)\}[\s\S]*tasteItems=\{tasteItems\}/,
  'the notification page must own the permission action and personalized artwork',
);
assert.doesNotMatch(
  source,
  /One permission, all useful updates|Release alerts for titles you follow|Social and shared-list activity|Important Watchly system updates|PermissionFact|StepHero/,
  'the last step must not retain the old card, duplicated hero, or benefit list',
);
assert.match(
  source,
  /getOnboardingTasteOptions\(\)[\s\S]*response\.movies[\s\S]*item\.posterUrl[\s\S]*setCataloguePosterItems[\s\S]*notificationPreviews\.map\(\(preview, index\)[\s\S]*<NotificationPreview[\s\S]*item=\{previewItems\[index\]\}/,
  'the page must fill notification examples with Taste posters or current TMDB movie posters',
);
assert.match(
  source,
  /item\?\.posterUrl[\s\S]*<MediaPoster[\s\S]*accessibilityLabel=\{`Artwork for \$\{item\.title\}`\}[\s\S]*<ActivityIndicator/,
  'notification examples must show posters with a neutral loading placeholder',
);
assert.doesNotMatch(
  source,
  /watchly-w-ui|watchly-popcorn-ui|assets\/icon\.png|fallbackSource|<Image/,
  'notification examples must never fall back to Watchly logos',
);
assert.match(
  source,
  /<Pressable[\s\S]*accessibilityLabel="Enable notifications"[\s\S]*styles\.notificationEnableAction[\s\S]*styles\.notificationEnableIcon[\s\S]*<BellRing[\s\S]*styles\.notificationEnableCopy[\s\S]*Enable notifications[\s\S]*Tap to turn on Watchly alerts[\s\S]*<ChevronRight/,
  'Enable notifications must be a labeled full-width CTA with a clear direction affordance',
);
assert.match(
  source,
  /notificationEnableAction: \{[\s\S]*alignSelf: 'stretch',[\s\S]*backgroundColor: colors\.accent,[\s\S]*flexDirection: 'row',[\s\S]*minHeight: 82,/,
  'the notification CTA must expose a stable full-width tap target',
);
assert.match(
  source,
  /pageStep === 'notifications'[\s\S]*styles\.notificationsScreenContent[\s\S]*notificationEnableAction: \{[\s\S]*marginTop: 'auto',/,
  'Enable notifications must sit at the bottom of the page content above the footer',
);
assert.match(
  source,
  /notificationsBackAction: \{\s*flex: 1,\s*\}[\s\S]*notificationsSkipAction: \{\s*flex: 2,\s*\}/,
  'Back must take one third and Not now must take two thirds',
);
assert.match(
  footerSource,
  /styles\.notificationsBackAction[\s\S]*label="Back"[\s\S]*styles\.notificationsSkipAction[\s\S]*label=\{notificationBlocked \? 'Continue without' : 'Not now'\}/,
  'Not now must replace Enable notifications in the bottom bar',
);
assert.match(
  source,
  /const \[notificationSkipConfirmationVisible, setNotificationSkipConfirmationVisible\] = useState\(false\);[\s\S]*function requestNotificationSkip\(\)[\s\S]*setNotificationSkipConfirmationVisible\(true\)/,
  'Not now must open an explicit confirmation before finishing onboarding',
);
assert.match(
  source,
  /function NotificationSkipConfirmation\(\)[\s\S]*Are you sure\?[\s\S]*Watchly won&apos;t be able to alert you when movies and TV shows you follow are released\.[\s\S]*turn notifications on later in Settings/,
  'the skip confirmation must clearly explain what notifications will be missed',
);
assert.match(
  footerSource,
  /notificationSkipConfirmationVisible[\s\S]*label="Enable notifications"[\s\S]*label="Continue without notifications"/,
  'the skip confirmation must offer an accessible opt-in and an explicit opt-out',
);
assert.doesNotMatch(
  footerSource,
  /onAllowNotifications/,
  'the initial notification footer must not own a duplicate permission action',
);
assert.match(
  source,
  /You can enable notifications in iPhone Settings &gt; Notifications &gt; Watchly\.[\s\S]*label="Open Settings"[\s\S]*Linking\.openSettings\(\)/,
  'a denied iOS permission must explain the exact recovery path and open device settings',
);

console.log('Onboarding notifications presentation QA passed.');
