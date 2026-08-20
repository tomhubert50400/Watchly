import { BadRequestException } from '@nestjs/common';

export const PROFILE_HANDLE_MAX_LENGTH = 20;
export const PROFILE_HANDLE_INPUT_MAX_LENGTH = PROFILE_HANDLE_MAX_LENGTH + 1;
export const PROFILE_HANDLE_INPUT_PATTERN = /^@?[a-zA-Z0-9_]{1,20}$/;
export const PROFILE_HANDLE_PATTERN = /^[a-z0-9_]{1,20}$/;

export function normalizeProfileHandle(value: string) {
  const handle = value.trim().replace(/^@/, '').toLowerCase();

  if (!PROFILE_HANDLE_PATTERN.test(handle)) {
    throw new BadRequestException(
      'Handle must use 1 to 20 letters, numbers, or underscores.',
    );
  }

  return handle;
}

export function isUniqueHandleError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002',
  );
}
