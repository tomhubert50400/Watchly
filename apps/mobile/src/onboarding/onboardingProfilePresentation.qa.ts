import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./OnboardingScreen.tsx', import.meta.url), 'utf8');

assert.match(
  source,
  /import \{ BrandWordmark \} from '\.\.\/brand\/BrandWordmark';/,
  'the profile title must use the official Watchly wordmark',
);
assert.match(
  source,
  /<Text style=\{styles\.profileHeadingText\}>Personalize your<\/Text>[\s\S]*<BrandWordmark height=\{32\} \/>/,
  'the profile title must pair Personalize your with the Watchly wordmark',
);
assert.match(
  source,
  /profileHeadingText: \{\s*\.\.\.typography\.title,\s*color: colors\.accentText,\s*\}/,
  'the Personalize your copy must use the Watchly pink text token',
);
assert.doesNotMatch(source, /eyebrow=\{`Onboarding /, 'onboarding must not repeat its step count in the header');
assert.match(
  source,
  /nativeKeyboardInsetsOnly[\s\S]*title=""/,
  'the onboarding screen must leave its generic title empty because each step owns its heading',
);
assert.doesNotMatch(
  source,
  /StepHero/,
  'onboarding must not render the removed duplicate hero card',
);
assert.doesNotMatch(source, /Your Watchly profile/, 'the profile form must not repeat its purpose');
assert.doesNotMatch(source, /We start with your sign-in photo/, 'the profile form must keep its photo copy concise');
assert.match(source, /<View style=\{styles\.profileContent\}>/, 'profile content must sit directly on the background');
assert.match(source, /label="Username"/, 'the permanent identifier field must be labelled Username');
assert.match(
  source,
  /onChangeText=\{\(value\) => onChange\(value\.replace\(\/\^@\/, ''\)\)\}[\s\S]*value=\{`@\$\{handle\}`\}/,
  'the username field must keep a visible at-sign while storing only the username',
);
assert.match(
  source,
  /style=\{\[styles\.actions, step === 'profile' \? styles\.profileActions : null\]\}[\s\S]*fullWidth=\{step === 'profile'\}/,
  'the profile Continue button must fill the available width',
);

console.log('Onboarding profile presentation QA passed.');
