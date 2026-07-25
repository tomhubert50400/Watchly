import type {
  ProfileOpinion,
  ProfileOpinionsResponse,
  UserProfile,
} from '../api/profile';
import type { RootStackParamList } from '../navigation/types';

type OpinionPresentation = {
  contentTitle: string;
  seriesTitle: string | null;
};

export type ProfileOpinionTarget =
  | { name: 'EpisodeDetail'; params: RootStackParamList['EpisodeDetail'] }
  | { name: 'FilmDetail'; params: RootStackParamList['FilmDetail'] };

export type ProfileModel = {
  displayName: string;
  isPublic: boolean;
  opinions: ProfileOpinion[];
  stats: {
    followersCount: number;
    followingCount: number;
    ratingsCount: number;
    reviewsCount: number;
  };
  userId: string;
};

export function buildProfileModel(
  profile: UserProfile,
  response: ProfileOpinionsResponse,
): ProfileModel {
  const opinions = response.items;

  return {
    displayName: profile.displayName?.trim() || 'Watchly member',
    isPublic: profile.privacy.profileVisibility === 'public',
    opinions,
    stats: {
      followersCount: response.stats.followersCount,
      followingCount: response.stats.followingCount,
      ratingsCount: response.stats.postsCount,
      reviewsCount: response.stats.reviewsCount,
    },
    userId: profile.id,
  };
}

export function isReview(opinion: ProfileOpinion) {
  return opinion.type === 'movieReview' || opinion.type === 'episodeReview';
}

export function getProfileOpinionTarget(
  opinion: ProfileOpinion,
  presentation: OpinionPresentation,
): ProfileOpinionTarget {
  if (opinion.content.contentType === 'movie') {
    return {
      name: 'FilmDetail',
      params: { title: presentation.contentTitle, tmdbId: opinion.content.tmdbId },
    };
  }

  const seriesTitle = presentation.seriesTitle?.trim();

  if (!seriesTitle) {
    throw new Error('Episode navigation requires the real series title.');
  }

  return {
    name: 'EpisodeDetail',
    params: {
      episodeNumber: opinion.content.episodeNumber,
      seasonNumber: opinion.content.seasonNumber,
      seriesTitle,
      title: presentation.contentTitle,
      tmdbId: opinion.content.seriesTmdbId,
    },
  };
}
