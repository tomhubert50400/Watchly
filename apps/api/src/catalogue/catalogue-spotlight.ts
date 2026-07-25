export type WeeklySpotlightCandidate = {
  backdrop_path?: string | null;
  id: number;
  release_date?: string;
  title?: string;
};

export const SPOTLIGHT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function chooseWeeklySpotlight<T extends WeeklySpotlightCandidate>(
  candidates: readonly T[],
  now: Date,
): T | null {
  const today = now.toISOString().slice(0, 10);

  return candidates.find((candidate) =>
    Boolean(
      candidate.title
      && candidate.backdrop_path
      && candidate.release_date
      && candidate.release_date <= today,
    ),
  ) ?? null;
}

export function getSpotlightExpiry(selectedAt: Date) {
  return new Date(selectedAt.getTime() + SPOTLIGHT_DURATION_MS);
}

export function isSpotlightActive(expiresAt: Date, now: Date) {
  return expiresAt.getTime() > now.getTime();
}
