import 'dotenv/config';
import { getAuth } from 'firebase-admin/auth';
import { initializeFirebaseAdmin } from '../auth/firebase-admin-app';

async function main() {
  const [action, email] = process.argv.slice(2);

  if ((action !== 'grant' && action !== 'revoke') || !email) {
    throw new Error('Usage: pnpm admin:access <grant|revoke> <verified-admin-email>');
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID is required.');
  }

  initializeFirebaseAdmin(projectId, process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

  const auth = getAuth();
  const user = await auth.getUserByEmail(email.trim().toLowerCase());

  if (action === 'grant') {
    if (!user.emailVerified) {
      throw new Error('The admin email must be verified before access is granted.');
    }

  }

  const customClaims = { ...user.customClaims };

  if (action === 'grant') {
    customClaims.admin = true;
  } else {
    delete customClaims.admin;
  }

  await auth.setCustomUserClaims(user.uid, customClaims);
  await auth.revokeRefreshTokens(user.uid);

  console.log(`Admin access ${action === 'grant' ? 'granted to' : 'revoked from'} ${user.email}.`);
  console.log('Existing sessions were revoked. Sign in again to obtain the updated claim.');
  if (action === 'grant' && !user.multiFactor?.enrolledFactors.length) {
    console.log('The administrator must enroll TOTP at /admin before moderation data is available.');
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
