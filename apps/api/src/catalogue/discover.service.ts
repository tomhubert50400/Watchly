import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TmdbCatalogueService } from './tmdb-catalogue.service';
import { awardWinners, discoverCollections, discoverKey, moodSelections, rankDiscoverTitles, type DiscoverCollectionId, type DiscoverMediaType, type DiscoverMood } from './discover-model';

@Injectable()
export class DiscoverService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TmdbCatalogueService) private readonly catalogue: TmdbCatalogueService,
  ) {}

  async home(firebaseUid?: string, mood: DiscoverMood | null = null) {
    const signals = await this.signals(firebaseUid);
    const seedResults = await Promise.allSettled(signals.seeds.map(seed => this.catalogue.discoverTitle(seed.mediaType, seed.tmdbId)));
    const seeds = seedResults.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    const requests = mood
      ? (['movie', 'series'] as const).flatMap(type => moodSelections[mood][type].map(id => this.catalogue.discoverTitle(type, id).then(result => [result.item])))
      : (['movie', 'series'] as const).map(type => this.catalogue.discoverCandidates(type));
    const candidateResults = await Promise.allSettled(requests);
    const candidates = candidateResults.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    if (!mood) candidates.push(...seeds.flatMap(seed => seed.recommendations));
    if (candidateResults.every(result => result.status === 'rejected') && candidates.length === 0) {
      throw new ServiceUnavailableException('Discovery is temporarily unavailable. Please try again.');
    }
    const items = rankDiscoverTitles(candidates.filter(item => item.posterUrl && item.releaseDate && item.releaseDate <= new Date().toISOString().slice(0, 10)), seeds, signals.excluded, mood).slice(0, 40);
    return {
      items, mood, personalized: seeds.length > 0,
      partial: candidateResults.some(result => result.status === 'rejected') || seedResults.some(result => result.status === 'rejected'),
    };
  }

  async collections() {
    const results = await Promise.allSettled(discoverCollections.map(async collection => {
      const response = await this.collection(collection.id, 1);
      return { ...collection, artwork: response.items.slice(0, 4).map(item => item.backdropUrl ?? item.posterUrl), partial: response.partial };
    }));
    if (results.every(result => result.status === 'rejected')) throw new ServiceUnavailableException('Collections are temporarily unavailable.');
    return {
      items: results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []),
      partial: results.some(result => result.status === 'rejected' || result.value.partial),
    };
  }

  async collection(id: DiscoverCollectionId, page: number) {
    if (id === 'award-winners') {
      if (page > 1) return { items: [], hasMore: false, partial: false };
      const results = await Promise.allSettled((['movie', 'series'] as const).flatMap(type => awardWinners[type].map(tmdbId => this.catalogue.discoverTitle(type, tmdbId))));
      if (results.every(result => result.status === 'rejected')) throw new ServiceUnavailableException('This collection is temporarily unavailable.');
      return { items: rankDiscoverTitles(results.flatMap(result => result.status === 'fulfilled' ? [result.value.item] : []), [], new Set(), null), hasMore: false, partial: results.some(result => result.status === 'rejected') };
    }
    const results = await Promise.allSettled((['movie', 'series'] as const).map(type => this.catalogue.discoverCandidates(type, id, page)));
    if (results.every(result => result.status === 'rejected')) throw new ServiceUnavailableException('This collection is temporarily unavailable.');
    const items = rankDiscoverTitles(results.flatMap(result => result.status === 'fulfilled' ? result.value : []), [], new Set(), null);
    return { items, hasMore: page < 50 && results.some(result => result.status === 'fulfilled' && result.value.length === 20), partial: results.some(result => result.status === 'rejected') };
  }

  private async signals(firebaseUid?: string) {
    const excluded = new Set<string>();
    const seeds: { mediaType: DiscoverMediaType; tmdbId: number }[] = [];
    if (!firebaseUid) return { excluded, seeds };
    const user = await this.prisma.withConnectionRetry(() => this.prisma.user.findUnique({ where: { firebaseUid }, select: { id: true } }));
    if (!user) return { excluded, seeds };
    const where = { userId: user.id };
    const [states, movies, series, episodes, viewings] = await this.prisma.withConnectionRetry(() => Promise.all([
      this.prisma.userContentState.findMany({ where, select: { contentType: true, tmdbId: true, favorite: true, status: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.userMovieRating.findMany({ where, select: { tmdbId: true, scoreHalfSteps: true }, orderBy: [{ scoreHalfSteps: 'desc' }, { updatedAt: 'desc' }] }),
      this.prisma.userSeriesRating.findMany({ where, select: { seriesTmdbId: true, scoreHalfSteps: true }, orderBy: [{ scoreHalfSteps: 'desc' }, { updatedAt: 'desc' }] }),
      this.prisma.userEpisodeProgress.findMany({ where, distinct: ['seriesTmdbId'], select: { seriesTmdbId: true } }),
      this.prisma.viewingEvent.findMany({ where, distinct: ['contentType', 'tmdbId'], select: { contentType: true, tmdbId: true } }),
    ]));
    for (const state of states) {
      const mediaType = state.contentType === 'MOVIE' ? 'movie' : 'series';
      if (state.status || state.favorite) excluded.add(discoverKey({ mediaType, tmdbId: state.tmdbId }));
      const rating = mediaType === 'movie' ? movies.find(item => item.tmdbId === state.tmdbId) : series.find(item => item.seriesTmdbId === state.tmdbId);
      if (state.favorite && (!rating || rating.scoreHalfSteps > 4)) seeds.push({ mediaType, tmdbId: state.tmdbId });
    }
    for (const rating of movies) {
      excluded.add(`movie:${rating.tmdbId}`);
      if (rating.scoreHalfSteps >= 8) seeds.push({ mediaType: 'movie', tmdbId: rating.tmdbId });
    }
    for (const rating of series) {
      excluded.add(`series:${rating.seriesTmdbId}`);
      if (rating.scoreHalfSteps >= 8) seeds.push({ mediaType: 'series', tmdbId: rating.seriesTmdbId });
    }
    for (const episode of episodes) excluded.add(`series:${episode.seriesTmdbId}`);
    for (const viewing of viewings) excluded.add(`${viewing.contentType === 'MOVIE' ? 'movie' : 'series'}:${viewing.tmdbId}`);
    const dropped = new Set(states.filter(state => state.status === 'DROPPED').map(state => `${state.contentType === 'MOVIE' ? 'movie' : 'series'}:${state.tmdbId}`));
    const unique = [...new Map(seeds.map(seed => [discoverKey(seed), seed])).values()].filter(seed => !dropped.has(discoverKey(seed)));
    return { excluded, seeds: (['movie', 'series'] as const).flatMap(type => unique.filter(seed => seed.mediaType === type).slice(0, 3)) };
  }
}
