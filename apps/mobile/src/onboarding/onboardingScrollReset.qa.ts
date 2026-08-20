import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./OnboardingScreen.tsx', import.meta.url), 'utf8');

assert.match(
  source,
  /AccessibilityInfo\.isReduceMotionEnabled\(\)[\s\S]*AccessibilityInfo\.addEventListener\(\s*'reduceMotionChanged'/,
  'onboarding step motion must respect the system reduced-motion preference',
);
assert.match(
  source,
  /const \[stepTransition, setStepTransition\] = useState<OnboardingStepTransition \| null>\(null\)/,
  'onboarding must keep both page identities while a transition is running',
);
assert.match(
  source,
  /function moveToStep\(nextStep: OnboardingStep\)[\s\S]*stepTransitionProgress\.setValue\(0\);[\s\S]*setStepTransition\(\{[\s\S]*from: step,[\s\S]*to: nextStep,[\s\S]*\}\)/,
  'step changes must reset the hidden pager before staging the source and destination',
);
assert.match(
  source,
  /Animated\.timing\(stepTransitionProgress,[\s\S]*toValue: 1,[\s\S]*useNativeDriver: true[\s\S]*setStep\(stepTransition\.to\)[\s\S]*setStepTransition\(null\)/,
  'the active step must change only after the full native page animation finishes',
);
assert.doesNotMatch(
  source,
  /setStep\(stepTransition\.to\);[\s\S]{0,200}stepTransitionProgress\.setValue\(0\)/,
  'the native pager position must not reset before React removes the previous page',
);
assert.match(
  source,
  /const transitionSteps:[^=]+ = stepTransition[\s\S]*\[stepTransition\.from, stepTransition\.to\][\s\S]*\[stepTransition\.to, stepTransition\.from\][\s\S]*: \[step\]/,
  'forward and backward transitions must render the source and destination together',
);
assert.match(
  source,
  /const stepTrackLeft = stepTransition\?\.direction === -1 \? -windowWidth : 0/,
  'the backward track must keep the current page in the viewport before native animation attaches',
);
assert.match(
  source,
  /outputRange: stepTransition\.direction === 1[\s\S]*\[0, -windowWidth\][\s\S]*\[0, windowWidth\]/,
  'the pager must travel one full viewport in the requested direction',
);
assert.match(
  source,
  /<Animated\.View[\s\S]*styles\.stepTrack[\s\S]*left: stepTrackLeft[\s\S]*transitionSteps\.map\(\(pageStep\)[\s\S]*key=\{pageStep\}[\s\S]*<Screen/,
  'the complete source and destination screens must share one animated track',
);
assert.doesNotMatch(
  source,
  /ONBOARDING_STEP_TRANSITION_DISTANCE|transform: \[\{ translateX: stepTransitionX \}\]/,
  'the old incoming-only partial slide must not return',
);
assert.match(
  source,
  /if \(step === 'import'\) moveToStep\('profile'\);[\s\S]*if \(step === 'taste'\) moveToStep\('import'\);/,
  'Back must use the same directional page transition as forward navigation',
);

console.log('Onboarding scroll reset QA passed.');
