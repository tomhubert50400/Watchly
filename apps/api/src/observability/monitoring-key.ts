import { timingSafeEqual } from 'node:crypto';

export function isMonitoringKeyValid(providedKey?: string, expectedKey?: string) {
  if (!providedKey || !expectedKey) return false;

  const provided = Buffer.from(providedKey);
  const expected = Buffer.from(expectedKey);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
