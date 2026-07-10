// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import type { SharedVotingSession } from '../api/sharedWatchlists';
import {
  beginOptimisticClose,
  beginOptimisticVote,
  canCloseVote,
  getSelectedCandidateIds,
  getVoteLifecycle,
  getVoteLeaders,
  getVoteRemainingLabel,
  rollbackVoteMutation,
} from './sharedVoteModel';

const NOW = new Date('2026-07-10T12:00:00.000Z');

function session(overrides: Partial<SharedVotingSession> = {}): SharedVotingSession {
  return {
    candidates: [
      { contentType: 'movie', id: 'candidate-a', itemId: 'item-a', tmdbId: 1, userHasVoted: true, voteCount: 2 },
      { contentType: 'movie', id: 'candidate-b', itemId: 'item-b', tmdbId: 2, userHasVoted: false, voteCount: 1 },
      { contentType: 'series', id: 'candidate-c', itemId: 'item-c', tmdbId: 3, userHasVoted: false, voteCount: 0 },
    ],
    closedAt: null,
    closesAt: '2026-07-10T12:12:30.000Z',
    createdAt: '2026-07-10T11:00:00.000Z',
    id: 'session',
    leaders: [],
    status: 'OPEN',
    title: 'Tonight',
    updatedAt: '2026-07-10T11:00:00.000Z',
    winningCandidateId: null,
    ...overrides,
  };
}

{
  const leaders = getVoteLeaders(session().candidates);
  assert.deepEqual(leaders.leaderIds, ['candidate-a']);
  assert.equal(leaders.isTie, false);
  assert.equal(leaders.maxVotes, 2);
}

{
  const tied = session({
    candidates: session().candidates.map((candidate) => ({ ...candidate, voteCount: candidate.id === 'candidate-c' ? 2 : candidate.voteCount })),
  });
  const leaders = getVoteLeaders(tied.candidates);
  assert.deepEqual(leaders.leaderIds, ['candidate-a', 'candidate-c']);
  assert.equal(leaders.isTie, true);
}

assert.equal(getVoteRemainingLabel(session(), NOW), '12 min remaining');
assert.equal(
  getVoteRemainingLabel(session({ closesAt: '2026-07-10T12:00:30.000Z' }), NOW),
  'Less than 1 min remaining',
);
assert.equal(
  getVoteRemainingLabel(session({ closesAt: '2026-07-12T12:00:00.000Z' }), NOW),
  '2 days remaining',
);
assert.equal(getVoteRemainingLabel(session({ status: 'CLOSED', closedAt: NOW.toISOString() }), NOW), 'Vote closed');
assert.equal(getVoteRemainingLabel(session({ closesAt: '2026-07-10T11:59:59.000Z' }), NOW), 'Vote expired');

assert.equal(getVoteLifecycle(session(), NOW), 'open');
assert.equal(getVoteLifecycle(session({ closesAt: '2026-07-10T11:59:59.000Z' }), NOW), 'expired');
assert.equal(getVoteLifecycle(session({ status: 'CLOSED', closedAt: NOW.toISOString() }), NOW), 'closed');
assert.deepEqual(getSelectedCandidateIds(session()), ['candidate-a']);
assert.equal(canCloseVote(true, session(), NOW), true);
assert.equal(canCloseVote(false, session(), NOW), false);
assert.equal(canCloseVote(true, session({ closesAt: '2026-07-10T11:59:59.000Z' }), NOW), false);

{
  const mutation = beginOptimisticVote(session(), 'candidate-b', NOW);
  if (!mutation) throw new Error('Expected an optimistic vote mutation.');
  assert.equal(mutation.optimistic.candidates[1]?.userHasVoted, true);
  assert.equal(mutation.optimistic.candidates[1]?.voteCount, 2);
  assert.deepEqual(getVoteLeaders(mutation.optimistic.candidates).leaderIds, ['candidate-a', 'candidate-b']);
  const concurrent = {
    ...mutation.optimistic,
    candidates: mutation.optimistic.candidates.map((candidate) =>
      candidate.id === 'candidate-c' ? { ...candidate, voteCount: 4 } : candidate,
    ),
  };
  const rolledBack = rollbackVoteMutation(mutation, concurrent);
  assert.equal(rolledBack.candidates[1]?.userHasVoted, false);
  assert.equal(rolledBack.candidates[1]?.voteCount, 1);
  assert.equal(rolledBack.candidates[2]?.voteCount, 4);
  assert.deepEqual(rolledBack.leaders.map((candidate) => candidate.id), ['candidate-c']);
}

{
  const mutation = beginOptimisticVote(session(), 'candidate-a', NOW);
  if (!mutation) throw new Error('Expected an optimistic unvote mutation.');
  assert.equal(mutation.optimistic.candidates[0]?.userHasVoted, false);
  assert.equal(mutation.optimistic.candidates[0]?.voteCount, 1);
}

assert.equal(
  beginOptimisticVote(session({ closesAt: '2026-07-10T11:59:59.000Z' }), 'candidate-a', NOW),
  null,
);

{
  const mutation = beginOptimisticClose(session(), true, NOW);
  if (!mutation) throw new Error('Expected an optimistic close mutation.');
  assert.equal(mutation.optimistic.status, 'CLOSED');
  assert.equal(mutation.optimistic.closedAt, NOW.toISOString());
  assert.equal(mutation.optimistic.winningCandidateId, 'candidate-a');
  const concurrent = {
    ...mutation.optimistic,
    candidates: mutation.optimistic.candidates.map((candidate) =>
      candidate.id === 'candidate-b' ? { ...candidate, voteCount: 3 } : candidate,
    ),
  };
  const rolledBack = rollbackVoteMutation(mutation, concurrent);
  assert.equal(rolledBack.status, 'OPEN');
  assert.equal(rolledBack.closedAt, null);
  assert.equal(rolledBack.winningCandidateId, null);
  assert.equal(rolledBack.candidates[1]?.voteCount, 3);
}

assert.equal(beginOptimisticClose(session(), false, NOW), null);
console.log('Shared vote model QA passed.');
