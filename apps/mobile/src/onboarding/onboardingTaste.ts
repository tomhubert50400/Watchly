import { OnboardingTasteItem } from './onboardingDraft';

export const ONBOARDING_TASTE_LIMIT_PER_TYPE = 5;
export const ONBOARDING_TASTE_TOTAL_LIMIT = ONBOARDING_TASTE_LIMIT_PER_TYPE * 2;

export function getOnboardingTasteCount(
  items: readonly OnboardingTasteItem[],
  contentType: OnboardingTasteItem['contentType'],
) {
  return items.filter((item) => item.contentType === contentType).length;
}

export function canAddOnboardingTasteItem(
  items: readonly OnboardingTasteItem[],
  contentType: OnboardingTasteItem['contentType'],
) {
  return getOnboardingTasteCount(items, contentType) < ONBOARDING_TASTE_LIMIT_PER_TYPE
    && items.length < ONBOARDING_TASTE_TOTAL_LIMIT;
}

export function isOnboardingTasteSelectionValid(items: readonly OnboardingTasteItem[]) {
  return items.length >= 1
    && items.length <= ONBOARDING_TASTE_TOTAL_LIMIT
    && getOnboardingTasteCount(items, 'movie') <= ONBOARDING_TASTE_LIMIT_PER_TYPE
    && getOnboardingTasteCount(items, 'series') <= ONBOARDING_TASTE_LIMIT_PER_TYPE;
}
