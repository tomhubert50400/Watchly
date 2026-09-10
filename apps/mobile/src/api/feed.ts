import { apiDelete, apiGet, apiPut } from './client';

export type FeedLikeState = {
  likeCount: number;
  likedByViewer: boolean;
};

export type FeedReviewTarget = {
  id: string;
  type: 'episodeReview' | 'movieReview';
};

type FeedAuthor = {
  avatarUrl: string | null;
  displayName: string | null;
  id: string;
};

type FeedMovieReviewItem = {
  author: FeedAuthor;
  body: string;
  content: {
    contentType: 'movie';
    tmdbId: number;
  };
  id: string;
  likeCount: number;
  likedByViewer: boolean;
  score: number | null;
  type: 'movieReview';
  updatedAt: string;
};

type FeedEpisodeReviewItem = {
  author: FeedAuthor;
  body: string;
  content: {
    contentType: 'episode';
    episodeNumber: number;
    seasonNumber: number;
    seriesTmdbId: number;
  };
  id: string;
  likeCount: number;
  likedByViewer: boolean;
  score: number | null;
  type: 'episodeReview';
  updatedAt: string;
};

export type FeedItem = FeedMovieReviewItem | FeedEpisodeReviewItem;

export type FeedResponse = {
  items: FeedItem[];
};

export type CommunityItem = Omit<FeedItem, 'content' | 'type'> & {
  content: FeedItem['content'] | { contentType: 'series'; seriesTmdbId: number };
  type: FeedItem['type'] | 'movieRating' | 'seriesRating' | 'episodeRating' | 'viewing';
  followed: boolean;
  viewerHasWatched: boolean;
  inWatchlist: boolean;
};

export function getCommunityFeed(token: string, cursor?: string) {
  return apiGet<{ items: CommunityItem[]; nextCursor: string | null }>(
    `/feed/community${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { token },
  );
}

export function getFeed(firebaseIdToken: string): Promise<FeedResponse> {
  return apiGet<FeedResponse>('/feed', {
    token: firebaseIdToken,
  });
}

export function setFeedItemLiked(
  firebaseIdToken: string,
  item: FeedReviewTarget,
  liked: boolean,
): Promise<FeedLikeState> {
  const reviewCollection = item.type === 'movieReview' ? 'movie-reviews' : 'episode-reviews';
  const path = `/feed/${reviewCollection}/${encodeURIComponent(item.id)}/like`;

  return liked
    ? apiPut<FeedLikeState>(path, {}, { token: firebaseIdToken })
    : apiDelete<FeedLikeState>(path, { token: firebaseIdToken });
}
