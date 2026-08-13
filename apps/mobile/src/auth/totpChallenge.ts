export type TotpFactorHint = {
  displayName?: string | null;
  factorId: string;
  uid: string;
};

export function selectTotpFactor(hints: TotpFactorHint[]): TotpFactorHint | null {
  return hints.find((hint) => hint.factorId === 'totp') ?? null;
}

export function normalizeTotpCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function isValidTotpCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function getTotpErrorMessage(error: unknown): string {
  const code = getErrorCode(error);

  if (code === 'auth/invalid-verification-code') {
    return 'That code is not valid. Check your authenticator and try again.';
  }

  if (
    code === 'auth/invalid-multi-factor-session'
    || code === 'auth/missing-multi-factor-session'
    || code === 'auth/multi-factor-info-not-found'
  ) {
    return 'This verification request expired. Sign in with Google again.';
  }

  return 'Could not verify that code. Try again.';
}

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;

  return typeof error.code === 'string' ? error.code : null;
}
