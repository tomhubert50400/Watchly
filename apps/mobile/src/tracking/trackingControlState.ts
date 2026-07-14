import type { TrackingStatus } from '../api/tracking';

type TrackingMutationSource = {
  favorite: boolean;
  status: TrackingStatus | null;
};

export type TrackingStateKnowledge = {
  isKnown: boolean;
  state: TrackingMutationSource | null;
};

export function buildTrackingMutation(
  knowledge: TrackingStateKnowledge,
  status: TrackingStatus | null,
): { favorite: boolean; status: TrackingStatus | null } | null {
  if (!knowledge.isKnown) {
    return null;
  }

  return {
    favorite: knowledge.state?.favorite ?? false,
    status,
  };
}
