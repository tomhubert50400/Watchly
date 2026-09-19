import { apiDelete, apiGet, apiPost, apiPut } from './client';

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
  replyCount: number;
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
  replyCount: number;
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

export type CommunityMode = 'for-you' | 'following';

export type ReviewReply = {
  author: FeedAuthor;
  body: string;
  containsSpoilers: boolean;
  createdAt: string;
  id: string;
  ownedByViewer: boolean;
  parentReplyId: string | null;
};

export type ReviewThreadReview = {
  author: FeedAuthor;
  body: string;
  content: FeedItem['content'];
  id: string;
  likeCount: number;
  likedByViewer: boolean;
  score: number | null;
  type: FeedReviewTarget['type'];
  updatedAt: string;
};

export type ReviewThreadPreview = ReviewThreadReview & {
  backgroundUrl: string | null;
  contentContext: string | null;
  contentImageUrl: string | null;
  contentMeta: string;
  contentTitle: string;
  spoilerReason: string | null;
};

export type ReviewRepliesResponse = {
  items: ReviewReply[];
  nextCursor: string | null;
  review: ReviewThreadReview;
};

export function getCommunityFeed(token: string, cursor?: string, mode: CommunityMode = 'for-you') {
  return apiGet<{ items: CommunityItem[]; nextCursor: string | null }>(
    `/feed/community?mode=${mode}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { token },
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

export function listReviewReplies(token: string, target: FeedReviewTarget, cursor?: string) {
  const collection = getReviewCollection(target.type);
  return apiGet<ReviewRepliesResponse>(
    `/feed/${collection}/${encodeURIComponent(target.id)}/replies${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    { token },
  );
}

export function createReviewReply(
  token: string,
  target: FeedReviewTarget,
  body: string,
  containsSpoilers: boolean,
  parentReplyId?: string,
) {
  return apiPost<ReviewReply>(
    `/feed/${getReviewCollection(target.type)}/${encodeURIComponent(target.id)}/replies`,
    { body, containsSpoilers, parentReplyId },
    { token },
  );
}

export function deleteReviewReply(token: string, replyId: string) {
  return apiDelete<{ deleted: true }>(`/feed/review-replies/${encodeURIComponent(replyId)}`, { token });
}

function getReviewCollection(type: FeedReviewTarget['type']) {
  return type === 'movieReview' ? 'movie-reviews' : 'episode-reviews';
}
