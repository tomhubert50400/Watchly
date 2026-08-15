// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { getOnboardingDraftKey } from './onboardingDraft';

assert.notEqual(getOnboardingDraftKey('user-a'), getOnboardingDraftKey('user-b'));
assert.match(getOnboardingDraftKey('user-a'), /^watchly:user:user-a:onboarding-draft$/);
assert.throws(() => getOnboardingDraftKey('user:a'), /without colons/);

console.log('Onboarding draft QA passed.');
