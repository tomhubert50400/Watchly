import type { DisplayRating } from '../api/catalogue';
import type { MovieCommunityResponse } from '../api/reviews';

export function getRatingDistribution(community: MovieCommunityResponse, rating?: DisplayRating | null) {
  if (community.ratingCount >= 100 || rating?.source !== 'tmdb' || rating.scale !== 10 || !rating.count
    || !Number.isSafeInteger(rating.count) || !Number.isFinite(rating.average)
    || rating.average < 1 || rating.average > 10) {
    return { ...community, estimated: false };
  }

  // A binomial model assumes a single peak. Mean and count cannot reveal the real shape.
  const count = rating.count;
  const mean = rating.average / 2;
  const p = (mean - 0.5) / 4.5;
  const coefficients = [1, 9, 36, 84, 126, 126, 84, 36, 9, 1];
  const expected = coefficients.map((coefficient, index) =>
    count * coefficient * p ** index * (1 - p) ** (9 - index));
  const counts = expected.map(Math.floor);
  const remainder = count - counts.reduce((sum, value) => sum + value, 0);
  const order = counts.map((_, index) => index).sort((a, b) =>
    (expected[b] - counts[b]) - (expected[a] - counts[a]) || a - b);
  for (let index = 0; index < remainder; index += 1) counts[order[index]] += 1;

  // Preserve both integer vote totals and the nearest representable weighted mean.
  let difference = Math.round(mean * 2 * count)
    - counts.reduce((sum, value, index) => sum + value * (index + 1), 0);
  while (difference !== 0) {
    const direction = Math.sign(difference);
    let best = -1;
    let cost = Infinity;
    for (let index = 0; index < 10; index += 1) {
      const next = index + direction;
      if (!counts[index] || next < 0 || next > 9) continue;
      const change = 2 * ((counts[next] - expected[next]) - (counts[index] - expected[index])) + 2;
      if (change < cost) { best = index; cost = change; }
    }
    counts[best] -= 1;
    counts[best + direction] += 1;
    difference -= direction;
  }
  return {
    ...community,
    estimated: true,
    averageScore: mean,
    ratingCount: count,
    distribution: counts.map((value, index) => ({ score: (index + 1) / 2, count: value })),
  };
}
