// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  applyLikeMutation,
  beginLikeMutation,
  rollbackLikeMutation,
} from './feedLikeModel';

const likeMutation = beginLikeMutation({ likeCount: 2, likedByViewer: false });
assert.deepEqual(likeMutation.optimistic, { likeCount: 3, likedByViewer: true });
assert.deepEqual(rollbackLikeMutation(likeMutation), { likeCount: 2, likedByViewer: false });

const unlikeMutation = beginLikeMutation({ likeCount: 1, likedByViewer: true });
assert.deepEqual(unlikeMutation.optimistic, { likeCount: 0, likedByViewer: false });
assert.deepEqual(
  beginLikeMutation({ likeCount: 0, likedByViewer: true }).optimistic,
  { likeCount: 0, likedByViewer: false },
);

const confirmed = applyLikeMutation({
  likeCount: 4,
  likedByViewer: true,
});
assert.deepEqual(confirmed, { likeCount: 4, likedByViewer: true });
assert.deepEqual(
  applyLikeMutation({ likeCount: -2, likedByViewer: false }),
  { likeCount: 0, likedByViewer: false },
);

console.log('Feed like model QA passed.');
