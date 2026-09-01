import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ViewingStats } from '../api/viewings';
import type { ImportReviewMatch, ImportSkippedTitle } from '../imports/importReviewModel';
import type { LegalDocumentId } from '../legal/legalDocuments';
import type { LibraryMediaItem } from '../library/useLibraryData';
import type { ProfileMediaFilter } from '../profile/profileMediaModel';

export type RootTabParamList = {
  Community: undefined;
  Explore: undefined;
  Home: undefined;
  Library: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  AllTimeStats: {
    profileBackdropUrl: string | null;
    stats?: ViewingStats;
  };
  BlockedUsers: undefined;
  EpisodeDetail: {
    episodeNumber: number;
    seasonNumber: number;
    seriesTitle: string;
    tmdbId: number;
    title: string;
  };
  ExploreDiscovery: {
    mediaType: 'movie' | 'series';
    section: 'announced' | 'trending';
  };
  FilmDetail: {
    title: string;
    tmdbId: number;
  };
  ImportData: undefined;
  ImportMatches: {
    matchedItems: ImportReviewMatch[];
    skippedItems: ImportSkippedTitle[];
  };
  Journal: undefined;
  LegalDocument: {
    document: LegalDocumentId;
  };
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Notifications: undefined;
  NotificationPreferences: undefined;
  Onboarding: undefined;
  PersonalWatchlist: {
    title: string;
    watchlistId: string;
  };
  ProfileMedia: {
    filter: ProfileMediaFilter;
    items?: LibraryMediaItem[];
    profileBackdropUrl?: string | null;
  };
  ReleaseCalendar: undefined;
  ProfileConnections: {
    kind: 'followers' | 'following';
    userId: string;
  };
  PublicProfile: {
    profilePreview?: {
      avatarUrl: string | null;
      displayName: string;
      handle: string;
    };
    previewOwnProfile?: boolean;
    userId: string;
  };
  SeasonDetail: {
    seasonNumber: number;
    seriesTitle: string;
    tmdbId: number;
    title: string;
  };
  SeriesDetail: {
    title: string;
    tmdbId: number;
  };
  Settings: undefined;
  SharedVotingSession: {
    sessionId: string;
    title: string;
    watchlistId: string;
  };
  SharedWatchlist: {
    title: string;
    watchlistId: string;
  };
};
