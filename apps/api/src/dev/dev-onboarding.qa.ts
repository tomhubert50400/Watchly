import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { assertOnboardingResetEnvironment } from './dev-onboarding.controller';

assert.doesNotThrow(() => assertOnboardingResetEnvironment('development'));
assert.doesNotThrow(() => assertOnboardingResetEnvironment('staging'));
assert.throws(
  () => assertOnboardingResetEnvironment('production'),
  ForbiddenException,
);

console.log('Dev onboarding reset QA passed.');
