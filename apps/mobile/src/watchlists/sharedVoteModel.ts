import type { SharedVotingCandidate, SharedVotingSession } from '../api/sharedWatchlists';

export type VoteLifecycle = 'open' | 'expired' | 'closed';

export type VoteLeaders = {
  isTie: boolean;
  leaderIds: string[];
  maxVotes: number;
};

export type VoteMutation = {
  candidateId?: string;
  kind: 'close' | 'vote';
  optimistic: SharedVotingSession;
  snapshot: SharedVotingSession;
};

export function getVoteLeaders(candidates: SharedVotingCandidate[]): VoteLeaders {
  const maxVotes = Math.max(0, ...candidates.map((candidate) => candidate.voteCount));
  const leaderIds = maxVotes === 0
    ? []
    : candidates.filter((candidate) => candidate.voteCount === maxVotes).map((candidate) => candidate.id);

  return {
    isTie: leaderIds.length > 1,
    leaderIds,
    maxVotes,
  };
}

export function getVoteLifecycle(session: SharedVotingSession, now = new Date()): VoteLifecycle {
  if (session.status === 'CLOSED') {
    return 'closed';
  }

  const closesAt = new Date(session.closesAt).getTime();
  return !Number.isFinite(closesAt) || closesAt <= now.getTime() ? 'expired' : 'open';
}

export function getVoteRemainingLabel(session: SharedVotingSession, now = new Date()) {
  const lifecycle = getVoteLifecycle(session, now);

  if (lifecycle === 'closed') {
    return 'Vote closed';
  }

  if (lifecycle === 'expired') {
    return 'Vote expired';
  }

  const remainingMs = new Date(session.closesAt).getTime() - now.getTime();
  const minutes = Math.floor(remainingMs / 60_000);

  if (minutes < 1) {
    return 'Less than 1 min remaining';
  }

  if (minutes < 60) {
    return `${minutes} min remaining`;
  }

  const hours = Math.floor(remainingMs / 3_600_000);
  if (hours < 48) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} remaining`;
  }

  const days = Math.floor(remainingMs / 86_400_000);
  return `${days} ${days === 1 ? 'day' : 'days'} remaining`;
}

export function getSelectedCandidateIds(session: SharedVotingSession) {
  return session.candidates
    .filter((candidate) => candidate.userHasVoted)
    .map((candidate) => candidate.id);
}

export function canCloseVote(isOwner: boolean, session: SharedVotingSession, now = new Date()) {
  return isOwner && getVoteLifecycle(session, now) === 'open';
}

export function beginOptimisticVote(
  session: SharedVotingSession,
  candidateId: string,
  now = new Date(),
): VoteMutation | null {
  if (getVoteLifecycle(session, now) !== 'open') {
    return null;
  }

  const candidate = session.candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    return null;
  }

  const candidates = session.candidates.map((item) => {
    if (item.id !== candidateId) {
      return item;
    }

    const userHasVoted = !item.userHasVoted;
    return {
      ...item,
      userHasVoted,
      voteCount: Math.max(0, item.voteCount + (userHasVoted ? 1 : -1)),
    };
  });

  return {
    candidateId,
    kind: 'vote',
    optimistic: withComputedLeaders({ ...session, candidates }),
    snapshot: session,
  };
}

export function beginOptimisticClose(
  session: SharedVotingSession,
  isOwner: boolean,
  now = new Date(),
): VoteMutation | null {
  if (!canCloseVote(isOwner, session, now)) {
    return null;
  }

  const leaders = getVoteLeaders(session.candidates);
  return {
    kind: 'close',
    optimistic: {
      ...withComputedLeaders(session),
      closedAt: now.toISOString(),
      status: 'CLOSED',
      updatedAt: now.toISOString(),
      winningCandidateId: leaders.leaderIds.length === 1 ? leaders.leaderIds[0]! : null,
    },
    snapshot: session,
  };
}

export function rollbackVoteMutation(
  mutation: VoteMutation,
  current: SharedVotingSession = mutation.optimistic,
) {
  if (mutation.kind === 'close') {
    return withComputedLeaders({
      ...current,
      closedAt: mutation.snapshot.closedAt,
      status: mutation.snapshot.status,
      updatedAt: mutation.snapshot.updatedAt,
      winningCandidateId: mutation.snapshot.winningCandidateId,
    });
  }

  const previousCandidate = mutation.snapshot.candidates.find(
    (candidate) => candidate.id === mutation.candidateId,
  );
  if (!previousCandidate) {
    return current;
  }

  return withComputedLeaders({
    ...current,
    candidates: current.candidates.map((candidate) =>
      candidate.id === mutation.candidateId ? previousCandidate : candidate,
    ),
  });
}

function withComputedLeaders(session: SharedVotingSession): SharedVotingSession {
  const { leaderIds } = getVoteLeaders(session.candidates);
  const leaderSet = new Set(leaderIds);
  return {
    ...session,
    leaders: session.candidates.filter((candidate) => leaderSet.has(candidate.id)),
  };
}
