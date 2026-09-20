// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  applyOperationFailure,
  applyOperationSuccess,
  buildClearPlan,
  buildDeleteReviewPlan,
  buildReviewSavePlan,
  canSaveReview,
  createOpinionState,
  getRatingFromTrackPosition,
  getRatingAccessibilityValue,
  isReviewDirty,
  type OpinionState,
  type OpinionOperation,
} from './opinionState';

assert.equal(getRatingFromTrackPosition(-12, 260), 0.5);
assert.equal(getRatingFromTrackPosition(0, 260), 0.5);
assert.equal(getRatingFromTrackPosition(26, 260), 0.5);
assert.equal(getRatingFromTrackPosition(26.01, 260), 1);
assert.equal(getRatingFromTrackPosition(130, 260), 2.5);
assert.equal(getRatingFromTrackPosition(234.01, 260), 5);
assert.equal(getRatingFromTrackPosition(400, 260), 5);
assert.deepEqual(getRatingAccessibilityValue(0.5), {
  max: 10,
  min: 0,
  now: 1,
  text: '0.5 out of 5',
});
assert.deepEqual(getRatingAccessibilityValue(null), {
  max: 10,
  min: 0,
  now: 0,
  text: 'Not rated',
});

const empty = createOpinionState(null, null);
assert.equal(isReviewDirty(empty), false);
assert.equal(canSaveReview(empty), false);

const ratingDraft = { ...empty, draftRating: 4.5 };
assert.equal(isReviewDirty(ratingDraft), false);
assert.equal(canSaveReview(ratingDraft), false);
assert.deepEqual(buildReviewSavePlan(ratingDraft), []);

const reviewWithoutRating = { ...empty, draftReview: 'Worth seeing.' };
assert.equal(isReviewDirty(reviewWithoutRating), true);
assert.equal(canSaveReview(reviewWithoutRating), false);
assert.deepEqual(buildReviewSavePlan(reviewWithoutRating), []);

const existing = createOpinionState(4, 'Original review');
assert.equal(canSaveReview({ ...existing, draftReview: '  ' }), false);
assert.deepEqual(buildReviewSavePlan({ ...existing, draftRating: 4, draftReview: 'Updated review' }), [
  { body: 'Updated review', kind: 'saveReview' },
]);
const changedRatingOnly = { ...existing, draftRating: 4.5 };
assert.equal(isReviewDirty(changedRatingOnly), false);
assert.equal(canSaveReview(changedRatingOnly), false);
assert.deepEqual(buildReviewSavePlan(changedRatingOnly), []);

let partial: OpinionState = { ...existing, draftRating: 4.5, draftReview: 'Updated review' };
partial = applyOperationSuccess(partial, { kind: 'saveRating', score: 4.5 });
assert.equal(partial.savedRating, 4.5);
assert.equal(partial.draftRating, 4.5);
assert.equal(partial.savedReview, 'Original review');
assert.equal(isReviewDirty(partial), true);
partial = applyOperationFailure(partial, { body: 'Updated review', kind: 'saveReview' }, 'Could not save your review.');
assert.equal(partial.savedRating, 4.5);
assert.equal(partial.draftRating, 4.5);
assert.equal(partial.savedReview, 'Original review');
assert.equal(partial.draftReview, 'Updated review');
assert.equal(partial.error, 'Your rating was saved, but your review was not. Could not save your review.');

const ratingFailureDraft = { ...empty, draftRating: 3.5, draftReview: 'Keep this text' };
const ratingFailure = applyOperationFailure(
  ratingFailureDraft,
  { kind: 'saveRating', score: 3.5 },
  'Could not save your rating.',
);
assert.deepEqual(
  { draftRating: ratingFailure.draftRating, draftReview: ratingFailure.draftReview, savedRating: ratingFailure.savedRating },
  { draftRating: 3.5, draftReview: 'Keep this text', savedRating: null },
);

const deletePlan: OpinionOperation[] = buildDeleteReviewPlan(existing);
assert.deepEqual(deletePlan, [{ kind: 'deleteReview' }]);
const deleted = applyOperationSuccess(existing, deletePlan[0]);
assert.equal(deleted.savedReview, null);
assert.equal(deleted.draftReview, '');

assert.deepEqual(buildClearPlan(existing), [{ kind: 'deleteReview' }, { kind: 'clearRating' }]);
assert.deepEqual(buildClearPlan(createOpinionState(4, null)), [{ kind: 'clearRating' }]);
let clearing = applyOperationSuccess(existing, { kind: 'deleteReview' });
clearing = applyOperationFailure(clearing, { kind: 'clearRating' }, 'Could not clear your rating.');
assert.equal(clearing.savedReview, null);
assert.equal(clearing.savedRating, 4);
assert.equal(clearing.error, 'Your review was deleted, but your rating was not cleared. Could not clear your rating.');

console.log('Opinion state QA passed.');
