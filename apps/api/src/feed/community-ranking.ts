export type CommunityMode = 'for-you' | 'following';

export type CommunityContent =
  | { contentType: 'movie'; tmdbId: number }
  | { contentType: 'series'; seriesTmdbId: number }
  | { contentType: 'episode'; seriesTmdbId: number; seasonNumber: number; episodeNumber: number };

export type CommunityItem = {
  id: string;
  author: { id: string; displayName: string | null; avatarUrl: string | null };
  body: string;
  content: CommunityContent;
  type: 'movieReview' | 'episodeReview' | 'movieRating' | 'seriesRating' | 'episodeRating' | 'viewing';
  score: number | null;
  likeCount: number;
  likedByViewer: boolean;
  updatedAt: string;
  followed: boolean;
  viewerHasWatched: boolean;
  inWatchlist: boolean;
  affinity: number;
};

export function followedShare(activeAuthors: number) {
  if (activeAuthors === 0) return 0;
  if (activeAuthors === 1) return 0.05;
  if (activeAuthors < 5) return 0.15;
  if (activeAuthors < 10) return 0.25;
  if (activeAuthors < 20) return 0.4;
  if (activeAuthors < 50) return 0.5;
  return 0.55;
}

export function contentKey(content: CommunityContent) {
  return content.contentType === 'movie' ? `MOVIE:${content.tmdbId}` : `SERIES:${content.seriesTmdbId}`;
}

export function rankCommunity(items: CommunityItem[], now: Date, limit = 150, mode: CommunityMode = 'for-you') {
  const recent = now.getTime() - 30 * 86400000;
  const active = new Set(items.filter((item) => item.followed && Date.parse(item.updatedAt) >= recent).map((item) => item.author.id));
  const share = mode === 'following' ? 1 : followedShare(active.size);
  const score = (item: CommunityItem) => {
    const days = Math.max(0, (now.getTime() - Date.parse(item.updatedAt)) / 86400000);
    const typeWeight = item.type.endsWith('Review') ? 12 : item.type === 'viewing' ? -12 : 0;
    return item.affinity + 20 / (1 + days / 7) + Math.min(6, Math.log2(1 + item.likeCount)) + typeWeight;
  };
  const pool = items.filter((item) => mode !== 'following' || item.followed).sort((a, b) => score(b) - score(a) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  const result: CommunityItem[] = [];
  let followed = 0;
  let viewings = 0;
  while (result.length < limit && pool.length) {
    const nextSize = result.length + 1;
    const allowFollowed = followed < Math.floor(nextSize * share + 1e-8);
    const eligible = (item: CommunityItem) => {
      if (item.followed && !allowFollowed) return false;
      if (item.type === 'viewing' && (!item.followed || viewings >= Math.floor(nextSize / 10) || result.at(-1)?.type === 'viewing')) return false;
      if (result.at(-1)?.author.id === item.author.id) return false;
      return result.slice(-19).filter((post) => post.author.id === item.author.id).length < 2;
    };
    // Reserve the progressively available slots for followed authors, then diversify titles.
    let index = allowFollowed ? pool.findIndex((item) => item.followed && eligible(item)) : -1;
    if (index < 0) index = pool.findIndex((item) => eligible(item) && !result.slice(-3).some((post) => contentKey(post.content) === contentKey(item.content)));
    if (index < 0) index = pool.findIndex(eligible);
    // Quotas and author diversity must not hide available opinions in a quiet feed.
    if (index < 0) index = pool.findIndex((item) => !item.followed && item.type !== 'viewing');
    if (index < 0) index = pool.findIndex((item) => item.type !== 'viewing');
    if (index < 0 && result.length === 0) index = pool.findIndex((item) => item.followed && item.type === 'viewing');
    if (index < 0) break;
    const [item] = pool.splice(index, 1);
    result.push(item);
    if (item.followed) followed += 1;
    if (item.type === 'viewing') viewings += 1;
  }
  return result;
}
