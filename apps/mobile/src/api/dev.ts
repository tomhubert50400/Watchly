import { apiPost } from './client';

export type UiReviewDataResponse = {
  feedReviewSource: {
    displayName: string | null;
    userId: string;
  };
  personalWatchlistId: string;
  prepared: true;
  seededTitles: {
    contentType: 'movie' | 'series';
    label: string;
    tmdbId: number;
  }[];
  sharedWatchlistId: string;
  testUser: {
    displayName: string | null;
    userId: string;
  };
  userId: string;
  votingSessionId: string;
};

export function prepareUiReviewData(token: string) {
  return apiPost<UiReviewDataResponse>('/dev/ui-review-data', {}, { token });
}
