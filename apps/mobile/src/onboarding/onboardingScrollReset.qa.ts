import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./OnboardingScreen.tsx', import.meta.url), 'utf8');

assert.match(
  source,
  /<Screen[\s\S]*?key=\{step\}/,
  'onboarding must remount its outer screen scroller whenever the active step changes',
);

console.log('Onboarding scroll reset QA passed.');
