export function formatCatalogueRating(voteAverage: number | null) {
  return voteAverage === null ? null : `${(voteAverage / 2).toFixed(1)}/5`;
}
