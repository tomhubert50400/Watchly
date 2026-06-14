import { apiGet } from './client';

type FeedAuthor = {
  displayName: string | null;
  id: string;
};

export type FeedMovieReviewItem = {
  author: FeedAuthor;
  body: string;
  content: {
    contentType: 'movie';
    tmdbId: number;
  };
  id: string;
  type: 'movieReview';
  updatedAt: string;
};

export type FeedEpisodeReviewItem = {
  author: FeedAuthor;
  body: string;
  content: {
    contentType: 'episode';
    episodeNumber: number;
    seasonNumber: number;
    seriesTmdbId: number;
  };
  id: string;
  type: 'episodeReview';
  updatedAt: string;
};

export type FeedItem = FeedMovieReviewItem | FeedEpisodeReviewItem;

export type FeedResponse = {
  items: FeedItem[];
};

export function getFeed(firebaseIdToken: string): Promise<FeedResponse> {
  return apiGet<FeedResponse>('/feed', {
    token: firebaseIdToken,
  });
}
