import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootTabParamList = {
  Explore: undefined;
  Home: undefined;
  Library: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  EpisodeDetail: {
    episodeNumber: number;
    seasonNumber: number;
    seriesTitle: string;
    tmdbId: number;
    title: string;
  };
  FilmDetail: {
    title: string;
    tmdbId: number;
  };
  Journal: undefined;
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Notifications: undefined;
  Onboarding: undefined;
  PersonalWatchlist: {
    title: string;
    watchlistId: string;
  };
  PublicProfile: {
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
