export type AuthTransitionGuard = {
  begin: () => number;
  current: () => number;
  invalidate: () => void;
  isCurrent: (version: number) => boolean;
};

type SignOutDependencies = {
  clearPrivateCacheForUser: (userId: string) => Promise<void>;
  signOutFromFirebase: () => Promise<void>;
};

export async function performGuaranteedSignOut(
  userId: string | undefined,
  dependencies: SignOutDependencies,
) {
  const firebaseResult = await dependencies.signOutFromFirebase().then(
    () => ({ error: null as unknown }),
    (error: unknown) => ({ error }),
  );
  const cleanupResult = userId
    ? await dependencies.clearPrivateCacheForUser(userId).then(
        () => ({ error: null as unknown }),
        (error: unknown) => ({ error }),
      )
    : { error: null as unknown };

  if (firebaseResult.error) throw firebaseResult.error;
  if (cleanupResult.error) throw cleanupResult.error;
}

export function createAuthTransitionGuard(): AuthTransitionGuard {
  let version = 0;

  return {
    begin: () => {
      version += 1;
      return version;
    },
    current: () => version,
    invalidate: () => {
      version += 1;
    },
    isCurrent: (candidate) => candidate === version,
  };
}
