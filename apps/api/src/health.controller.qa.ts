import assert from 'node:assert/strict';
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { HealthController } from './health.controller';

type ExplicitDependency = {
  index: number;
  param: unknown;
};

const dependencies = Reflect.getMetadata(
  SELF_DECLARED_DEPS_METADATA,
  HealthController,
) as ExplicitDependency[] | undefined;

assert.ok(
  dependencies?.some(
    (dependency) => dependency.index === 0 && dependency.param === ConfigService,
  ),
  'HealthController must explicitly inject ConfigService under the tsx runtime.',
);

const controller = new HealthController({
  getOrThrow: (key: string) => {
    assert.equal(key, 'APP_ENV');
    return 'development';
  },
} as ConfigService);

assert.equal(controller.health().environment, 'development');
assert.equal(controller.health().status, 'ok');

console.log('Health controller QA passed.');
