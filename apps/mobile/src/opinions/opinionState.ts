export const MAX_REVIEW_LENGTH = 5000;

export type OpinionOperation =
  | { kind: 'saveRating'; score: number }
  | { body: string; kind: 'saveReview' }
  | { kind: 'deleteReview' }
  | { kind: 'clearRating' };

export type OpinionState = {
  draftRating: number | null;
  draftReview: string;
  error: string | null;
  savedRating: number | null;
  savedReview: string | null;
  successfulOperations: OpinionOperation['kind'][];
};

export function createOpinionState(rating: number | null, review: string | null): OpinionState {
  return {
    draftRating: rating,
    draftReview: review ?? '',
    error: null,
    savedRating: rating,
    savedReview: review,
    successfulOperations: [],
  };
}

export function getHalfStarScore(star: number, locationX: number, targetWidth: number) {
  const boundedStar = Math.min(5, Math.max(1, Math.round(star)));
  return locationX <= targetWidth / 2 ? boundedStar - 0.5 : boundedStar;
}

export function isOpinionDirty(state: OpinionState) {
  return state.draftRating !== state.savedRating || state.draftReview !== (state.savedReview ?? '');
}

export function canSaveOpinion(state: OpinionState) {
  if (!isOpinionDirty(state) || state.draftRating === null) {
    return false;
  }

  const reviewChanged = state.draftReview !== (state.savedReview ?? '');
  if (!reviewChanged) {
    return state.draftRating !== state.savedRating;
  }

  const trimmedReview = state.draftReview.trim();
  return trimmedReview.length > 0 && state.draftReview.length <= MAX_REVIEW_LENGTH;
}

export function buildSavePlan(state: OpinionState): OpinionOperation[] {
  if (!canSaveOpinion(state)) {
    return [];
  }

  const operations: OpinionOperation[] = [];
  if (state.draftRating !== state.savedRating && state.draftRating !== null) {
    operations.push({ kind: 'saveRating', score: state.draftRating });
  }
  if (state.draftReview !== (state.savedReview ?? '')) {
    operations.push({ body: state.draftReview.trim(), kind: 'saveReview' });
  }
  return operations;
}

export function buildDeleteReviewPlan(state: OpinionState): OpinionOperation[] {
  return state.savedReview === null ? [] : [{ kind: 'deleteReview' }];
}

export function buildClearPlan(state: OpinionState): OpinionOperation[] {
  if (state.savedRating === null) {
    return [];
  }

  return state.savedReview === null
    ? [{ kind: 'clearRating' }]
    : [{ kind: 'deleteReview' }, { kind: 'clearRating' }];
}

export function applyOperationSuccess(state: OpinionState, operation: OpinionOperation): OpinionState {
  const successfulOperations = [...state.successfulOperations, operation.kind];

  switch (operation.kind) {
    case 'saveRating':
      return { ...state, error: null, savedRating: operation.score, successfulOperations };
    case 'saveReview':
      return {
        ...state,
        draftReview: operation.body,
        error: null,
        savedReview: operation.body,
        successfulOperations,
      };
    case 'deleteReview':
      return {
        ...state,
        draftReview: '',
        error: null,
        savedReview: null,
        successfulOperations,
      };
    case 'clearRating':
      return {
        ...state,
        draftRating: null,
        error: null,
        savedRating: null,
        successfulOperations,
      };
  }
}

export function applyOperationFailure(
  state: OpinionState,
  operation: OpinionOperation,
  message: string,
): OpinionState {
  let error = message;
  if (operation.kind === 'saveReview' && state.successfulOperations.includes('saveRating')) {
    error = `Your rating was saved, but your review was not. ${message}`;
  } else if (operation.kind === 'clearRating' && state.successfulOperations.includes('deleteReview')) {
    error = `Your review was deleted, but your rating was not cleared. ${message}`;
  }

  return { ...state, error };
}

export function resetOpinionDraft(state: OpinionState): OpinionState {
  return {
    ...state,
    draftRating: state.savedRating,
    draftReview: state.savedReview ?? '',
    error: null,
    successfulOperations: [],
  };
}

export function beginOpinionOperations(state: OpinionState): OpinionState {
  return { ...state, error: null, successfulOperations: [] };
}
