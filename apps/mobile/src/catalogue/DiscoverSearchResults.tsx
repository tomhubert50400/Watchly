import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { searchCatalogue, type CatalogueSearchItem, type CatalogueSearchType } from '../api/catalogue';
import { searchProfiles, type ProfileSearchItem } from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import type { RootStackParamList } from '../navigation/types';
import { SearchComposition } from './ExploreScreen';
import { deduplicateMediaItems, getExploreViewState } from './exploreState';

export function DiscoverSearchResults({ query, searchType }: { query: string; searchType: CatalogueSearchType }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, firebaseIdToken } = useAuthSession();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string; items: CatalogueSearchItem[]; people: ProfileSearchItem[]; error: string | null;
  } | null>(null);
  const key = JSON.stringify([query, searchType, firebaseIdToken, revision]);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      void Promise.all([
        searchCatalogue(query, searchType),
        firebaseIdToken && searchType === 'all' ? searchProfiles(firebaseIdToken, query) : Promise.resolve({ items: [] }),
      ]).then(([catalogue, profiles]) => {
        if (current) setResult({ key, items: deduplicateMediaItems(catalogue.items), people: profiles.items, error: null });
      }).catch((error: unknown) => {
        if (current) setResult({ key, items: [], people: [], error: error instanceof Error ? error.message : 'Search failed.' });
      });
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [key, query, searchType, firebaseIdToken]);

  const visible = result?.key === key ? result : null;
  return <SearchComposition
    error={visible?.error ?? null}
    isLoading={!visible}
    items={visible?.items ?? []}
    people={visible?.people ?? []}
    searchType={searchType}
    viewState={getExploreViewState({ activeSection: 'trending', query, error: visible?.error ?? null, isLoading: !visible, itemCount: (visible?.items.length ?? 0) + (visible?.people.length ?? 0) })}
    onRetry={() => setRevision(value => value + 1)}
    onOpen={item => navigation.navigate(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title: item.title, tmdbId: item.tmdbId })}
    onOpenPerson={person => navigation.navigate('PublicProfile', {
      profilePreview: { avatarUrl: person.avatarUrl, displayName: person.displayName, handle: person.handle },
      previewOwnProfile: person.id === currentUser?.id,
      userId: person.id,
    })}
  />;
}
