import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { assertDevelopmentOnboardingReset } from './dev-onboarding.controller';

assert.doesNotThrow(() => assertDevelopmentOnboardingReset('development', 'development'));
assert.throws(
  () => assertDevelopmentOnboardingReset('staging', 'development'),
  ForbiddenException,
);
assert.throws(
  () => assertDevelopmentOnboardingReset('development', 'production'),
  ForbiddenException,
);

console.log('Dev onboarding reset QA passed.');
