import { apiPost } from './client';

export type OnboardingResetMode = 'full' | 'legacy';

export function resetOnboarding(token: string, mode: OnboardingResetMode) {
  return apiPost<{
    handle: null;
    id: string;
    onboardingCompleted: boolean;
  }>(`/dev/onboarding/${mode}/reset`, {}, { token });
}
