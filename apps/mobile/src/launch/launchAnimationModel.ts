export const launchTimeline = {
  deployEndMs: 2_900,
  deployStartMs: 2_200,
  dockEndMs: 5_530,
  dockStartMs: 4_330,
  fillEndMs: 2_250,
  fillStartMs: 500,
  introEndMs: 650,
  introStartMs: 100,
  lettersEndMs: 4_230,
  lettersStartMs: 3_000,
  minimumDurationMs: 7_000,
  revealDurationMs: 900,
  revealLatestStartMs: 6_100,
} as const;

export function resolveLaunchRevealStart(homeReadyAtMs: number | null) {
  const requestedStart = homeReadyAtMs ?? launchTimeline.revealLatestStartMs;

  return Math.min(
    launchTimeline.revealLatestStartMs,
    Math.max(launchTimeline.dockEndMs, requestedStart),
  );
}
