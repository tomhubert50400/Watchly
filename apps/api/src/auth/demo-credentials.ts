import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
export const DEMO_FIREBASE_UID = 'watchly-review';

export async function hashDemoPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}

export async function verifyDemoPassword(password: string, encoded: string) {
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded);
  if (!match) return false;
  const key = await deriveKey(password, match[1], 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(match[2], 'hex'));
}
