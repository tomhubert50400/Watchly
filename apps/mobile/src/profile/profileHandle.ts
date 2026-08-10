export const PROFILE_HANDLE_MAX_LENGTH = 20;
export const PROFILE_HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeProfileHandleInput(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function getProfileHandleError(value: string) {
  const handle = normalizeProfileHandleInput(value);

  if (handle.length < 3) {
    return 'Use at least 3 characters.';
  }

  if (handle.length > PROFILE_HANDLE_MAX_LENGTH) {
    return `Use no more than ${PROFILE_HANDLE_MAX_LENGTH} characters.`;
  }

  if (!PROFILE_HANDLE_PATTERN.test(handle)) {
    return 'Use only letters, numbers, and underscores.';
  }

  return null;
}

export function formatProfileHandle(handle: string | null) {
  return handle ? `@${handle}` : null;
}
