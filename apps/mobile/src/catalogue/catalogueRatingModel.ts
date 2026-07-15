export function formatCatalogueRating(voteAverage: number | null) {
  return voteAverage === null ? null : `${voteAverage.toFixed(1)}/10`;
}
