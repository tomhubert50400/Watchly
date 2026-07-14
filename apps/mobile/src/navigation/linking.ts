import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const appLinking: LinkingOptions<RootStackParamList> = {
  config: {
    screens: {
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
    },
  },
  prefixes: ['tvapp://', 'com.tom.tvapp.dev://'],
};
