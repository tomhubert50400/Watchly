export type FeedLikeState = {
  likeCount: number;
  likedByViewer: boolean;
};

export type FeedLikeMutation = {
  optimistic: FeedLikeState;
  snapshot: FeedLikeState;
};

export function beginLikeMutation(state: FeedLikeState): FeedLikeMutation {
  const likedByViewer = !state.likedByViewer;

  return {
    optimistic: {
      likeCount: Math.max(0, state.likeCount + (likedByViewer ? 1 : -1)),
      likedByViewer,
    },
    snapshot: state,
  };
}

export function applyLikeMutation(state: FeedLikeState): FeedLikeState {
  return {
    likeCount: Math.max(0, state.likeCount),
    likedByViewer: state.likedByViewer,
  };
}

export function rollbackLikeMutation(mutation: FeedLikeMutation): FeedLikeState {
  return mutation.snapshot;
}
