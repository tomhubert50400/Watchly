import { AuthProvider } from '../generated/prisma/enums';

export type AuthenticatedIdentity = {
  displayName: string | null;
  provider: AuthProvider;
  providerUserId: string;
};

export type AuthenticatedRequest = {
  authIdentity?: AuthenticatedIdentity;
  headers: {
    authorization?: string | string[];
  };
};

export type AuthenticatedAdmin = {
  email: string;
  firebaseUid: string;
  secondFactor: string;
};

export type AdminRequest = AuthenticatedRequest & {
  adminIdentity?: AuthenticatedAdmin;
};
