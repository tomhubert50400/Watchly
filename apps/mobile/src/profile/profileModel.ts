import type {
  ProfileOpinion,
  ProfileOpinionsResponse,
  UserProfile,
} from '../api/profile';
import type { RootStackParamList } from '../navigation/types';

type OpinionPresentation = {
  authorDisplayName: string;
  contentImageUrl: string | null;
  contentSubtitle: string;
  contentTitle: string;
  seriesTitle: string | null;
};

export type ProfileOpinionTarget =
  | { name: 'EpisodeDetail'; params: RootStackParamList['EpisodeDetail'] }
  | { name: 'FilmDetail'; params: RootStackParamList['FilmDetail'] }
  | { name: 'ReviewDetail'; params: RootStackParamList['ReviewDetail'] };

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
  const opinions = response.items.filter((opinion) => {
    if (isReview(opinion)) {
      return profile.privacy.profileVisibility === 'public';
    }

    return profile.privacy.ratingsVisibility === 'public';
  });

  return {
    displayName: profile.displayName?.trim() || 'Watchly member',
    isPublic: profile.privacy.profileVisibility === 'public',
    opinions,
    stats: {
      followersCount: response.stats.followersCount,
      followingCount: response.stats.followingCount,
      ratingsCount: opinions.length,
      reviewsCount: opinions.filter(isReview).length,
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
  if (isReview(opinion)) {
    const target = opinion.content.contentType === 'movie'
      ? opinion.content
      : {
          ...opinion.content,
          seriesTitle: presentation.seriesTitle ?? `Series ${opinion.content.seriesTmdbId}`,
        };

    return {
      name: 'ReviewDetail',
      params: {
        authorDisplayName: presentation.authorDisplayName,
        body: opinion.body,
        contentImageUrl: presentation.contentImageUrl,
        contentSubtitle: presentation.contentSubtitle,
        contentTitle: presentation.contentTitle,
        rating: opinion.score,
        target,
        updatedAt: opinion.updatedAt,
      },
    };
  }

  if (opinion.content.contentType === 'movie') {
    return {
      name: 'FilmDetail',
      params: { title: presentation.contentTitle, tmdbId: opinion.content.tmdbId },
    };
  }

  return {
    name: 'EpisodeDetail',
    params: {
      episodeNumber: opinion.content.episodeNumber,
      seasonNumber: opinion.content.seasonNumber,
      seriesTitle: presentation.seriesTitle ?? `Series ${opinion.content.seriesTmdbId}`,
      title: presentation.contentTitle,
      tmdbId: opinion.content.seriesTmdbId,
    },
  };
}
