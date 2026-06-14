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
  MainTabs: undefined;
  Onboarding: undefined;
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
  SharedWatchlist: {
    title: string;
    watchlistId: string;
  };
};
