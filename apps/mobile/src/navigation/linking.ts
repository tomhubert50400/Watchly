import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const appLinking: LinkingOptions<RootStackParamList> = {
  config: {
    screens: {
      ReviewAccess: 'review-access',
      FilmDetail: {
        path: 'film/:tmdbId',
        parse: {
          tmdbId: Number,
        },
      },
      MainTabs: {
        screens: {
          Library: 'library',
        },
      },
      Notifications: 'alerts',
      SeriesDetail: {
        path: 'series/:tmdbId',
        parse: {
          tmdbId: Number,
        },
      },
    },
  },
  prefixes: ['tvapp://', 'com.tom.tvapp.dev://', 'com.trywatchly.app://'],
};
