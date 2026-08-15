import {
  getPrivateCacheKey,
  readPersistedCache,
  removePersistedCache,
  writePersistedCache,
} from '../cache/persistedCache';

export type OnboardingStep = 'import' | 'notifications' | 'profile' | 'taste';

export type OnboardingTasteItem = {
  contentType: 'movie' | 'series';
  posterUrl: string | null;
  title: string;
  tmdbId: number;
};

export type OnboardingDraft = {
  avatarUrl: string | null;
  completedImportIds: string[];
  displayName: string;
  handle: string;
  importSatisfied: boolean;
  step: OnboardingStep;
  tasteItems: OnboardingTasteItem[];
  version: 1;
};

export function getOnboardingDraftKey(userId: string) {
  return getPrivateCacheKey(userId, 'onboarding-draft');
}

export async function readOnboardingDraft(userId: string) {
  const envelope = await readPersistedCache<OnboardingDraft>(getOnboardingDraftKey(userId));
  return envelope?.data.version === 1 ? envelope.data : null;
}

export function writeOnboardingDraft(userId: string, draft: OnboardingDraft) {
  return writePersistedCache(getOnboardingDraftKey(userId), draft);
}

export function clearOnboardingDraft(userId: string) {
  return removePersistedCache(getOnboardingDraftKey(userId));
}
