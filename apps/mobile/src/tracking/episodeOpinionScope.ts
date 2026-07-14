export function buildEpisodeOpinionResourceKey(
  ownerId: string | null | undefined,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return `${ownerId ?? 'signed-out'}:series:${seriesTmdbId}:season:${seasonNumber}:episode:${episodeNumber}`;
}
