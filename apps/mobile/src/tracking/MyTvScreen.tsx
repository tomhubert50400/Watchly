import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Clapperboard,
  MessageSquareText,
  PlusCircle,
  Shield,
  Star,
  Trash2,
  Users,
  Vote,
} from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMovieDetails, getSeriesDetails, SeriesDetails } from '../api/catalogue';
import {
  disableReleaseAlert,
  enableReleaseAlert,
  listReleaseAlerts,
  ReleaseAlertSummary,
  ReleaseAlertsResponse,
} from '../api/notifications';
import {
  listSeriesProgressSummaries,
  SeriesProgressSummariesResponse,
  SeriesProgressSummary,
} from '../api/progress';
import { listMovieRatings, MovieRating } from '../api/ratings';
import {
  createSharedWatchlist,
  deleteSharedWatchlist,
  listSharedWatchlists,
  SharedWatchlistSummary,
} from '../api/sharedWatchlists';
import { listTrackingStates, TrackingState } from '../api/tracking';
import {
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  PersonalWatchlistSummary,
} from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextInput } from '../components/TextInput';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { useWatchlistCache } from '../watchlists/WatchlistCacheContext';

type LibraryItem = {
  contentType: TrackingState['contentType'];
  favorite: boolean;
  hasReleaseAlert: boolean;
  inferredWatchingFromProgress: boolean;
  key: string;
  posterUrl: string | null;
  ratingScore: number | null;
  resumeEpisodeNumber: number | null;
  resumeSeasonNumber: number | null;
  status: TrackingState['status'];
  title: string;
  tmdbId: number;
  updatedAt: string;
  watchedEpisodeCount: number;
};

type LibraryItemBase = Omit<LibraryItem, 'posterUrl' | 'title'>;

type HydratedLibraryItem = LibraryItemBase & {
  numberOfEpisodes: number | null;
  numberOfSeasons: number | null;
  posterUrl: string | null;
  title: string;
};

type MyTvTab = 'overview' | 'watchlists' | 'trackedTitles';

type WatchlistItem = {
  id: string;
  isOwner: boolean;
  itemCount: number;
  key: string;
  kind: 'personal' | 'shared';
  memberCount: number | null;
  name: string;
  updatedAt: string;
};

export function MyTvScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { firebaseIdToken, getFirebaseIdToken, notifyTrackingChanged, trackingRevision } = useAuthSession();
  const {
    personalWatchlists: cachedWatchlists,
    removePersonalWatchlist,
    removeSharedWatchlist,
    setPersonalWatchlists: setCachedWatchlists,
    setSharedWatchlists: setCachedSharedWatchlists,
    sharedWatchlists: cachedSharedWatchlists,
  } = useWatchlistCache();
  const [activeTab, setActiveTab] = useState<MyTvTab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HydratedLibraryItem[]>([]);
  const [releaseAlertActionKey, setReleaseAlertActionKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingWatchlist, setIsSavingWatchlist] = useState(false);
  const [newWatchlistKind, setNewWatchlistKind] = useState<WatchlistItem['kind']>('personal');
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [sharedWatchlists, setSharedWatchlists] = useState<SharedWatchlistSummary[]>(cachedSharedWatchlists);
  const [watchlistActionError, setWatchlistActionError] = useState<string | null>(null);
  const [watchlists, setWatchlists] = useState<PersonalWatchlistSummary[]>(cachedWatchlists);

  const loadItems = useCallback(async () => {
    if (!firebaseIdToken) {
      setItems([]);
      setError(null);
      setSharedWatchlists([]);
      setWatchlists([]);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to load My TV.');
      }

      const [
        statesResult,
        ratingsResult,
        progressResult,
        watchlistsResult,
        sharedWatchlistsResult,
        releaseAlertsResult,
      ] =
        await Promise.allSettled([
        listTrackingStates(token),
        listMovieRatings(token),
        listSeriesProgressSummaries(token),
        listWatchlists(token),
        listSharedWatchlists(token),
        listReleaseAlerts(token),
      ]);

      if (
        statesResult.status === 'rejected' &&
        ratingsResult.status === 'rejected' &&
        progressResult.status === 'rejected' &&
        watchlistsResult.status === 'rejected' &&
        sharedWatchlistsResult.status === 'rejected' &&
        releaseAlertsResult.status === 'rejected'
      ) {
        throw new Error(
          buildPartialErrorMessage(
            statesResult,
            ratingsResult,
            progressResult,
            watchlistsResult,
            sharedWatchlistsResult,
            releaseAlertsResult,
          ),
        );
      }

      const states = statesResult.status === 'fulfilled' ? statesResult.value : [];
      const ratings = ratingsResult.status === 'fulfilled' ? ratingsResult.value : [];
      const progress = progressResult.status === 'fulfilled' ? progressResult.value.items : [];
      const releaseAlerts = releaseAlertsResult.status === 'fulfilled' ? releaseAlertsResult.value.items : [];
      const nextWatchlists = watchlistsResult.status === 'fulfilled' ? watchlistsResult.value.items : [];
      const nextSharedWatchlists =
        sharedWatchlistsResult.status === 'fulfilled' ? sharedWatchlistsResult.value.items : [];
      const hasPartialFailure =
        statesResult.status === 'rejected' ||
        ratingsResult.status === 'rejected' ||
        progressResult.status === 'rejected' ||
        watchlistsResult.status === 'rejected' ||
        sharedWatchlistsResult.status === 'rejected' ||
        releaseAlertsResult.status === 'rejected';
      const libraryItems = mergeLibraryItems(states, ratings, progress, releaseAlerts);
      const hydratedItems = (await Promise.all(libraryItems.map(hydrateLibraryItem))).filter(shouldShowTrackedTitle);

      setItems(hydratedItems);
      setSharedWatchlists(nextSharedWatchlists);
      setWatchlists(nextWatchlists);
      setCachedSharedWatchlists(nextSharedWatchlists);
      setCachedWatchlists(nextWatchlists);
      setError(
        hasPartialFailure
          ? buildPartialErrorMessage(
              statesResult,
              ratingsResult,
              progressResult,
              watchlistsResult,
              sharedWatchlistsResult,
              releaseAlertsResult,
            )
          : null,
      );
    } catch (loadError) {
      setItems([]);
      setSharedWatchlists([]);
      setWatchlists([]);
      setError(loadError instanceof Error ? loadError.message : 'Could not load your tracked titles.');
    } finally {
      setIsLoading(false);
    }
  }, [firebaseIdToken, getFirebaseIdToken, setCachedSharedWatchlists, setCachedWatchlists]);

  useEffect(() => {
    void loadItems();
  }, [loadItems, trackingRevision]);

  useEffect(() => {
    setSharedWatchlists(cachedSharedWatchlists);
  }, [cachedSharedWatchlists]);

  useEffect(() => {
    setWatchlists(cachedWatchlists);
  }, [cachedWatchlists]);

  function openItem(item: HydratedLibraryItem) {
    if (item.contentType === 'movie') {
      navigation.navigate('FilmDetail', {
        title: item.title,
        tmdbId: item.tmdbId,
      });
      return;
    }

    navigation.navigate('SeriesDetail', {
      title: item.title,
      tmdbId: item.tmdbId,
    });
  }

  async function handleToggleReleaseAlert(item: HydratedLibraryItem) {
    if (!firebaseIdToken || releaseAlertActionKey) {
      return;
    }

    setReleaseAlertActionKey(item.key);
    setError(null);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to update this alert.');
      }

      if (item.hasReleaseAlert) {
        await disableReleaseAlert(token, item.contentType, item.tmdbId);
      } else {
        await enableReleaseAlert(token, item.contentType, item.tmdbId);
      }

      setItems((current) =>
        current
          .map((currentItem) =>
            currentItem.key === item.key
              ? { ...currentItem, hasReleaseAlert: !item.hasReleaseAlert }
              : currentItem,
          )
          .filter(shouldShowTrackedTitle),
      );
      notifyTrackingChanged();
    } catch (alertError) {
      setError(alertError instanceof Error ? alertError.message : 'Could not update this alert.');
    } finally {
      setReleaseAlertActionKey(null);
    }
  }

  async function handleCreateWatchlist() {
    const name = newWatchlistName.trim();

    if (!firebaseIdToken || name.length === 0 || isSavingWatchlist) {
      return;
    }

    setIsSavingWatchlist(true);
    setWatchlistActionError(null);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to create a watchlist.');
      }

      if (newWatchlistKind === 'personal') {
        const watchlist = await createWatchlist(token, name);

        setWatchlists((current) => [watchlist, ...current]);
        setCachedWatchlists([watchlist, ...watchlists]);
      } else {
        const watchlist = await createSharedWatchlist(token, name);

        setSharedWatchlists((current) => [watchlist, ...current]);
        setCachedSharedWatchlists([watchlist, ...sharedWatchlists]);
      }

      setNewWatchlistName('');
    } catch (createError) {
      setWatchlistActionError(
        createError instanceof Error ? createError.message : 'Could not create this watchlist.',
      );
    } finally {
      setIsSavingWatchlist(false);
    }
  }

  async function handleDeleteWatchlist(watchlist: WatchlistItem) {
    if (!firebaseIdToken) {
      return;
    }

    setWatchlistActionError(null);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to delete a watchlist.');
      }

      if (watchlist.kind === 'personal') {
        await deleteWatchlist(token, watchlist.id);
        setWatchlists((current) => current.filter((item) => item.id !== watchlist.id));
        removePersonalWatchlist(watchlist.id);
      } else {
        await deleteSharedWatchlist(token, watchlist.id);
        setSharedWatchlists((current) => current.filter((item) => item.id !== watchlist.id));
        removeSharedWatchlist(watchlist.id);
      }
    } catch (deleteError) {
      setWatchlistActionError(
        deleteError instanceof Error ? deleteError.message : 'Could not delete this watchlist.',
      );
    }
  }

  function openWatchlist(watchlist: WatchlistItem) {
    if (watchlist.kind === 'personal') {
      navigation.navigate('PersonalWatchlist', {
        title: watchlist.name,
        watchlistId: watchlist.id,
      });
      return;
    }

    navigation.navigate('SharedWatchlist', {
      title: watchlist.name,
      watchlistId: watchlist.id,
    });
  }

  return (
    <Screen title="Manage your watch life">
      {!firebaseIdToken ? (
        <EmptyState
          body="Sign in from Profile, then track a film or series from its detail page."
          title="Sign in to build My TV"
        />
      ) : isLoading ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading My TV</Text>
        </View>
      ) : error && items.length === 0 && watchlists.length === 0 && sharedWatchlists.length === 0 ? (
        <EmptyState body={error} title="My TV failed">
          <Button label="Retry" onPress={loadItems} />
        </EmptyState>
      ) : (
        <>
          <MyTvTabs activeTab={activeTab} onChangeTab={setActiveTab} />
          {activeTab === 'overview' ? (
            <OverviewTab
              items={items}
              onOpenItem={openItem}
              onOpenWatchlist={openWatchlist}
              sharedWatchlists={sharedWatchlists}
              watchlists={watchlists}
            />
          ) : activeTab === 'watchlists' ? (
            <WatchlistsTab
              actionError={watchlistActionError}
              isSaving={isSavingWatchlist}
              name={newWatchlistName}
              onChangeKind={setNewWatchlistKind}
              onChangeName={setNewWatchlistName}
              onCreate={handleCreateWatchlist}
              onDelete={handleDeleteWatchlist}
              onOpen={openWatchlist}
              selectedKind={newWatchlistKind}
              sharedWatchlists={sharedWatchlists}
              watchlists={watchlists}
            />
          ) : (
            <TrackedTitlesTab
              alertActionKey={releaseAlertActionKey}
              items={items}
              onToggleReleaseAlert={handleToggleReleaseAlert}
              onOpenItem={openItem}
            />
          )}
        </>
      )}
    </Screen>
  );
}

function OverviewTab({
  items,
  onOpenItem,
  onOpenWatchlist,
  sharedWatchlists,
  watchlists,
}: {
  items: HydratedLibraryItem[];
  onOpenItem: (item: HydratedLibraryItem) => void;
  onOpenWatchlist: (watchlist: WatchlistItem) => void;
  sharedWatchlists: SharedWatchlistSummary[];
  watchlists: PersonalWatchlistSummary[];
}) {
  const listItems = getWatchlistItems(watchlists, sharedWatchlists);
  const firstPersonalList = listItems.find((item) => item.kind === 'personal');
  const firstSharedList = listItems.find((item) => item.kind === 'shared');
  const firstTrackedTitle = items[0] ?? null;

  return (
    <View style={styles.section}>
      <View style={styles.overviewPanel}>
        <View style={styles.overviewHeader}>
          <View style={styles.rowCopy}>
            <Text style={styles.overviewEyebrow}>Watchly overview</Text>
            <Text style={styles.overviewTitle}>Everything in one user surface</Text>
            <Text style={styles.overviewBody}>
              Tracking, ratings, reviews, personal lists, shared lists, voting, alerts, profile safety, and feed states.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.featureGrid}>
        <FeatureCard
          icon={Clapperboard}
          label="Tracking"
          value={items.length === 1 ? '1 title' : `${items.length} titles`}
        />
        <FeatureCard icon={Star} label="Ratings" value={getRatingSummary(items)} />
        <FeatureCard icon={MessageSquareText} label="Reviews" value="Film and episode review states" />
        <FeatureCard icon={Users} label="Shared lists" value={`${sharedWatchlists.length} active`} />
        <FeatureCard icon={Vote} label="Voting" value="Shared decision sessions" />
        <FeatureCard icon={Bell} label="Alerts" value="Release bell states" />
        <FeatureCard icon={Shield} label="Privacy" value="Profile, reviews, blocks" />
        <FeatureCard icon={CheckCircle2} label="Progress" value={getProgressSummary(items)} />
      </View>

      <View style={styles.overviewPanel}>
        <Text style={styles.sectionTitle}>Open key surfaces</Text>
        <View style={styles.quickRows}>
          {firstTrackedTitle ? (
            <OverviewQuickRow
              label="Tracked title"
              meta={buildOverviewMeta(firstTrackedTitle)}
              onPress={() => onOpenItem(firstTrackedTitle)}
              title={firstTrackedTitle.title}
            />
          ) : null}
          {firstPersonalList ? (
            <OverviewQuickRow
              label="Personal watchlist"
              meta={buildWatchlistMeta(firstPersonalList)}
              onPress={() => onOpenWatchlist(firstPersonalList)}
              title={firstPersonalList.name}
            />
          ) : null}
          {firstSharedList ? (
            <OverviewQuickRow
              label="Shared watchlist"
              meta={`${buildWatchlistMeta(firstSharedList)} / Members and votes`}
              onPress={() => onOpenWatchlist(firstSharedList)}
              title={firstSharedList.name}
            />
          ) : null}
          {!firstTrackedTitle && !firstPersonalList && !firstSharedList ? (
            <Text style={styles.emptyInline}>Add sample activity or start from Explore.</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function FeatureCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clapperboard;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIconFrame}>
        <Icon color={colors.accent} size={17} strokeWidth={2.2} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.featureValue}>
        {value}
      </Text>
    </View>
  );
}

function OverviewQuickRow({
  label,
  meta,
  onPress,
  title,
}: {
  label: string;
  meta: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickRow, pressed && styles.rowPressed]}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.quickLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.watchlistName}>
          {title}
        </Text>
        <Text numberOfLines={2} style={styles.previewMeta}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

function MyTvTabs({
  activeTab,
  onChangeTab,
}: {
  activeTab: MyTvTab;
  onChangeTab: (tab: MyTvTab) => void;
}) {
  return (
    <SegmentedControl
      containerStyle={styles.segmentedControl}
      onChange={onChangeTab}
      options={[
        { label: 'Overview', value: 'overview' },
        { label: 'Watchlists', value: 'watchlists' },
        { label: 'Tracked titles', value: 'trackedTitles' },
      ]}
      value={activeTab}
    />
  );
}

function WatchlistsTab({
  actionError,
  isSaving,
  name,
  onChangeKind,
  onChangeName,
  onCreate,
  onDelete,
  onOpen,
  selectedKind,
  sharedWatchlists,
  watchlists,
}: {
  actionError: string | null;
  isSaving: boolean;
  name: string;
  onChangeKind: (kind: WatchlistItem['kind']) => void;
  onChangeName: (name: string) => void;
  onCreate: () => void;
  onDelete: (watchlist: WatchlistItem) => void;
  onOpen: (watchlist: WatchlistItem) => void;
  selectedKind: WatchlistItem['kind'];
  sharedWatchlists: SharedWatchlistSummary[];
  watchlists: PersonalWatchlistSummary[];
}) {
  const listItems = getWatchlistItems(watchlists, sharedWatchlists);
  const canCreate = name.trim().length > 0 && !isSaving;

  return (
    <View style={styles.section}>
      <View style={styles.watchlistCreatePanel}>
        <SegmentedControl
          buttonMinHeight={32}
          onChange={onChangeKind}
          options={[
            { label: 'Personal', value: 'personal' },
            { label: 'Shared', value: 'shared' },
          ]}
          value={selectedKind}
        />
        <View style={styles.createRow}>
          <View style={styles.createInput}>
            <TextInput
              label="New watchlist"
              maxLength={80}
              onChangeText={onChangeName}
              onSubmitEditing={canCreate ? onCreate : undefined}
              placeholder={selectedKind === 'personal' ? 'Weekend ideas' : 'Tonight'}
              returnKeyType="done"
              value={name}
            />
          </View>
          <Pressable
            accessibilityLabel={`Create ${selectedKind} watchlist`}
            accessibilityRole="button"
            disabled={!canCreate}
            onPress={onCreate}
            style={({ pressed }) => [
              styles.createButton,
              !canCreate && styles.disabledButton,
              pressed && canCreate ? styles.rowPressed : null,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <PlusCircle color={colors.textOnAccent} size={21} strokeWidth={2.2} />
            )}
          </Pressable>
        </View>
      </View>
      {actionError ? <Text style={styles.warning}>{actionError}</Text> : null}
      {listItems.length === 0 ? (
        <Text style={styles.emptyInline}>No watchlists yet.</Text>
      ) : (
        <View style={styles.watchlistRows}>
          {listItems.map((watchlist) => (
            <Pressable
              accessibilityLabel={`Open ${watchlist.name}`}
              accessibilityRole="button"
              key={watchlist.key}
              onPress={() => onOpen(watchlist)}
              style={({ pressed }) => [styles.watchlistRow, pressed && styles.rowPressed]}
            >
              {watchlist.kind === 'shared' ? (
                <View style={styles.sharedIconFrame}>
                  <Users color={colors.accent} size={16} strokeWidth={2} />
                </View>
              ) : null}
              <View style={styles.rowCopy}>
                <Text numberOfLines={1} style={styles.watchlistName}>
                  {watchlist.name}
                </Text>
                <Text style={styles.previewMeta}>{buildWatchlistMeta(watchlist)}</Text>
              </View>
              {watchlist.isOwner ? (
                <Pressable
                  accessibilityLabel={`Delete ${watchlist.name}`}
                  accessibilityRole="button"
                  onPress={(event) => {
                    event.stopPropagation();
                    void onDelete(watchlist);
                  }}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.rowPressed]}
                >
                  <Trash2 color={colors.danger} size={17} strokeWidth={2} />
                </Pressable>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function TrackedTitlesTab({
  alertActionKey,
  items,
  onToggleReleaseAlert,
  onOpenItem,
}: {
  alertActionKey: string | null;
  items: HydratedLibraryItem[];
  onToggleReleaseAlert: (item: HydratedLibraryItem) => void;
  onOpenItem: (item: HydratedLibraryItem) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        body="Mark a title as watching or enable a release bell from a detail page."
        title="No tracked titles yet"
      />
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.list}>
        {items.map((item) => (
          <Pressable
            accessibilityLabel={`Open ${item.title}`}
            accessibilityRole="button"
            key={item.key}
            onPress={() => onOpenItem(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            {item.posterUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={`${item.title} poster`}
                source={{ uri: item.posterUrl }}
                style={styles.poster}
              />
            ) : (
              <View style={styles.posterPlaceholder} />
            )}
            <View style={styles.rowCopy}>
              <Text style={styles.rowEyebrow}>{getTypeLabel(item)}</Text>
              <Text numberOfLines={2} style={styles.title}>
                {item.title}
              </Text>
              {getSeasonLabel(item) ? <Text style={styles.meta}>{getSeasonLabel(item)}</Text> : null}
              {getCurrentLabel(item) ? <Text style={styles.meta}>{getCurrentLabel(item)}</Text> : null}
            </View>
            <Pressable
              accessibilityLabel={
                item.hasReleaseAlert
                  ? `Disable ${item.title} release alerts`
                  : `Enable ${item.title} release alerts`
              }
              accessibilityRole="button"
              accessibilityState={{ selected: item.hasReleaseAlert }}
              disabled={alertActionKey === item.key}
              onPress={(event) => {
                event.stopPropagation();
                onToggleReleaseAlert(item);
              }}
              style={({ pressed }) => [
                styles.alertButton,
                item.hasReleaseAlert && styles.alertButtonEnabled,
                pressed && styles.rowPressed,
                alertActionKey === item.key && styles.disabledButton,
              ]}
            >
              {item.hasReleaseAlert ? (
                <BellRing color={colors.textOnAccent} size={19} strokeWidth={2.2} />
              ) : (
                <BellOff color={colors.muted} size={19} strokeWidth={2.2} />
              )}
            </Pressable>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function getWatchlistItems(
  watchlists: PersonalWatchlistSummary[],
  sharedWatchlists: SharedWatchlistSummary[],
): WatchlistItem[] {
  return [
    ...watchlists.map((watchlist) => ({
      id: watchlist.id,
      isOwner: true,
      itemCount: watchlist.itemCount,
      key: `personal:${watchlist.id}`,
      kind: 'personal' as const,
      memberCount: null,
      name: watchlist.name,
      updatedAt: watchlist.updatedAt,
    })),
    ...sharedWatchlists.map((watchlist) => ({
      id: watchlist.id,
      isOwner: watchlist.isOwner,
      itemCount: watchlist.itemCount,
      key: `shared:${watchlist.id}`,
      kind: 'shared' as const,
      memberCount: watchlist.memberCount,
      name: watchlist.name,
      updatedAt: watchlist.updatedAt,
    })),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function buildWatchlistMeta(list: WatchlistItem) {
  const titleLabel = list.itemCount === 1 ? '1 title' : `${list.itemCount} titles`;

  if (list.kind === 'personal') {
    return `Personal / ${titleLabel}`;
  }

  const memberLabel = list.memberCount === 1 ? '1 member' : `${list.memberCount ?? 0} members`;

  return `Shared / ${memberLabel} / ${titleLabel}`;
}

function getRatingSummary(items: HydratedLibraryItem[]) {
  const ratedCount = items.filter((item) => item.ratingScore !== null).length;

  if (ratedCount === 0) {
    return 'Half-star ratings';
  }

  return ratedCount === 1 ? '1 rated title' : `${ratedCount} rated titles`;
}

function getProgressSummary(items: HydratedLibraryItem[]) {
  const watchedCount = items.reduce((total, item) => total + item.watchedEpisodeCount, 0);

  if (watchedCount === 0) {
    return 'Resume watching';
  }

  return watchedCount === 1 ? '1 episode watched' : `${watchedCount} episodes watched`;
}

function mergeLibraryItems(
  states: TrackingState[],
  ratings: MovieRating[],
  progress: SeriesProgressSummary[],
  releaseAlerts: ReleaseAlertSummary[],
): LibraryItemBase[] {
  const byContent = new Map<string, LibraryItemBase>();

  states.forEach((state) => {
    const key = `${state.contentType}:${state.tmdbId}`;

    byContent.set(key, {
      contentType: state.contentType,
      favorite: state.favorite,
      hasReleaseAlert: false,
      inferredWatchingFromProgress: false,
      key,
      ratingScore: null,
      resumeEpisodeNumber: null,
      resumeSeasonNumber: null,
      status: state.status,
      tmdbId: state.tmdbId,
      updatedAt: state.updatedAt,
      watchedEpisodeCount: 0,
    });
  });

  ratings.forEach((rating) => {
    const key = `movie:${rating.tmdbId}`;
    const existing = byContent.get(key);

    if (!existing) {
      return;
    }

    byContent.set(key, {
      contentType: 'movie',
      favorite: existing?.favorite ?? false,
      hasReleaseAlert: existing?.hasReleaseAlert ?? false,
      inferredWatchingFromProgress: existing?.inferredWatchingFromProgress ?? false,
      key,
      ratingScore: rating.score,
      resumeEpisodeNumber: existing?.resumeEpisodeNumber ?? null,
      resumeSeasonNumber: existing?.resumeSeasonNumber ?? null,
      status: existing?.status ?? null,
      tmdbId: rating.tmdbId,
      updatedAt: maxDateString(existing?.updatedAt, rating.updatedAt),
      watchedEpisodeCount: existing?.watchedEpisodeCount ?? 0,
    });
  });

  progress.forEach((summary) => {
    const key = `series:${summary.seriesTmdbId}`;
    const existing = byContent.get(key);

    byContent.set(key, {
      contentType: 'series',
      favorite: existing?.favorite ?? false,
      hasReleaseAlert: existing?.hasReleaseAlert ?? false,
      inferredWatchingFromProgress: existing ? existing.inferredWatchingFromProgress : true,
      key,
      ratingScore: existing?.ratingScore ?? null,
      resumeEpisodeNumber: summary.latestEpisodeNumber,
      resumeSeasonNumber: summary.latestSeasonNumber,
      status: existing?.status ?? 'watching',
      tmdbId: summary.seriesTmdbId,
      updatedAt: maxDateString(existing?.updatedAt, summary.updatedAt),
      watchedEpisodeCount: summary.watchedEpisodeCount,
    });
  });

  releaseAlerts.forEach((alert) => {
    const key = `${alert.contentType}:${alert.tmdbId}`;
    const existing = byContent.get(key);

    byContent.set(key, {
      contentType: alert.contentType,
      favorite: existing?.favorite ?? false,
      hasReleaseAlert: true,
      inferredWatchingFromProgress: existing?.inferredWatchingFromProgress ?? false,
      key,
      ratingScore: existing?.ratingScore ?? null,
      resumeEpisodeNumber: existing?.resumeEpisodeNumber ?? null,
      resumeSeasonNumber: existing?.resumeSeasonNumber ?? null,
      status: existing?.status ?? null,
      tmdbId: alert.tmdbId,
      updatedAt: maxDateString(existing?.updatedAt, alert.updatedAt),
      watchedEpisodeCount: existing?.watchedEpisodeCount ?? 0,
    });
  });

  return Array.from(byContent.values()).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function shouldShowTrackedTitle(item: HydratedLibraryItem) {
  if (item.hasReleaseAlert) {
    return true;
  }

  if (item.status !== 'watching') {
    return false;
  }

  if (!item.inferredWatchingFromProgress) {
    return true;
  }

  return item.resumeSeasonNumber !== null && item.resumeEpisodeNumber !== null;
}

function buildPartialErrorMessage(
  statesResult: PromiseSettledResult<TrackingState[]>,
  ratingsResult: PromiseSettledResult<MovieRating[]>,
  progressResult: PromiseSettledResult<SeriesProgressSummariesResponse>,
  watchlistsResult: PromiseSettledResult<{ items: PersonalWatchlistSummary[] }>,
  sharedWatchlistsResult: PromiseSettledResult<{ items: SharedWatchlistSummary[] }>,
  releaseAlertsResult: PromiseSettledResult<ReleaseAlertsResponse>,
) {
  const failedLabels = [
    statesResult.status === 'rejected' ? `tracking (${getErrorLabel(statesResult.reason)})` : null,
    ratingsResult.status === 'rejected' ? `ratings (${getErrorLabel(ratingsResult.reason)})` : null,
    progressResult.status === 'rejected' ? `progress (${getErrorLabel(progressResult.reason)})` : null,
    watchlistsResult.status === 'rejected'
      ? `watchlists (${getErrorLabel(watchlistsResult.reason)})`
      : null,
    sharedWatchlistsResult.status === 'rejected'
      ? `shared lists (${getErrorLabel(sharedWatchlistsResult.reason)})`
      : null,
    releaseAlertsResult.status === 'rejected'
      ? `release alerts (${getErrorLabel(releaseAlertsResult.reason)})`
      : null,
  ].filter(Boolean);

  return `Some My TV data could not load: ${failedLabels.join(', ')}.`;
}

function getErrorLabel(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'unknown error';
}

async function hydrateLibraryItem(item: LibraryItemBase): Promise<HydratedLibraryItem> {
  try {
    if (item.contentType === 'movie') {
      const response = await getMovieDetails(item.tmdbId);

      return {
        ...item,
        numberOfEpisodes: null,
        numberOfSeasons: null,
        posterUrl: response.item.posterUrl,
        title: response.item.title,
      };
    }

    const response = await getSeriesDetails(item.tmdbId);
    const resumeEpisode = getResumeEpisode(response.item.seasons, item);

    return {
      ...item,
      numberOfEpisodes: response.item.numberOfEpisodes,
      numberOfSeasons: response.item.numberOfSeasons,
      posterUrl: response.item.posterUrl,
      resumeEpisodeNumber: resumeEpisode?.episodeNumber ?? null,
      resumeSeasonNumber: resumeEpisode?.seasonNumber ?? null,
      title: response.item.title,
    };
  } catch {
    return {
      ...item,
      numberOfEpisodes: null,
      numberOfSeasons: null,
      posterUrl: null,
      title: `TMDB ${item.tmdbId}`,
    };
  }
}

function maxDateString(left: string | undefined, right: string) {
  if (!left) {
    return right;
  }

  return left.localeCompare(right) > 0 ? left : right;
}

function getTypeLabel(item: HydratedLibraryItem) {
  return item.contentType === 'movie' ? 'Film' : 'Series';
}

function getSeasonLabel(item: HydratedLibraryItem) {
  if (item.contentType !== 'series') {
    return null;
  }

  if (item.numberOfSeasons !== null) {
    return item.numberOfSeasons === 1 ? '1 season' : `${item.numberOfSeasons} seasons`;
  }

  if (item.numberOfEpisodes !== null) {
    return item.numberOfEpisodes === 1 ? '1 episode' : `${item.numberOfEpisodes} episodes`;
  }

  return null;
}

function getCurrentLabel(item: HydratedLibraryItem) {
  if (item.contentType !== 'series' || !item.resumeSeasonNumber || !item.resumeEpisodeNumber) {
    return null;
  }

  return `Current S${item.resumeSeasonNumber} E${item.resumeEpisodeNumber}`;
}

function buildOverviewMeta(item: HydratedLibraryItem) {
  return [getTypeLabel(item), getSeasonLabel(item), getCurrentLabel(item)].filter(Boolean).join(' / ');
}

function getResumeEpisode(
  seasons: SeriesDetails['seasons'],
  item: LibraryItemBase,
): { episodeNumber: number; seasonNumber: number } | null {
  if (!item.resumeSeasonNumber || !item.resumeEpisodeNumber) {
    return null;
  }

  const currentEpisodeNumber = item.resumeEpisodeNumber;
  const currentSeasonNumber = item.resumeSeasonNumber;
  const orderedSeasons = seasons
    .filter((season) => season.seasonNumber > 0 && (season.episodeCount ?? 0) > 0)
    .sort((left, right) => left.seasonNumber - right.seasonNumber);
  const currentSeason = orderedSeasons.find((season) => season.seasonNumber === currentSeasonNumber);
  const currentSeasonEpisodeCount = currentSeason?.episodeCount ?? 0;

  if (currentSeason && currentEpisodeNumber < currentSeasonEpisodeCount) {
    return {
      episodeNumber: currentEpisodeNumber + 1,
      seasonNumber: currentSeasonNumber,
    };
  }

  const nextSeason = orderedSeasons.find((season) => season.seasonNumber > currentSeasonNumber);

  if (!nextSeason) {
    return null;
  }

  return {
    episodeNumber: 1,
    seasonNumber: nextSeason.seasonNumber,
  };
}

const styles = StyleSheet.create({
  alertButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  alertButtonEnabled: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  emptyInline: {
    ...typography.body,
    color: colors.muted,
  },
  createButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  featureCard: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 118,
    padding: spacing.md,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  featureIconFrame: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  featureLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  featureValue: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 17,
  },
  overviewActionText: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  overviewBody: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  overviewButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  overviewEyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
  },
  overviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  overviewPanel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  overviewTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
  quickLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  quickRow: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickRows: {
    gap: spacing.sm,
  },
  createInput: {
    flex: 1,
    minWidth: 0,
  },
  createRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.dangerBackground,
    borderColor: colors.danger,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  disabledButton: {
    opacity: 0.45,
  },
  list: {
    gap: spacing.md,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  poster: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 108,
    width: 72,
  },
  posterPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 108,
    width: 72,
  },
  row: {
    ...shadows.panel,
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowCopy: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  rowEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  rowPressed: {
    opacity: 0.78,
  },
  previewMeta: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  section: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  segmentedControl: {
    marginBottom: spacing.lg,
  },
  sharedIconFrame: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  sectionBody: {
    ...typography.body,
    color: colors.muted,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  warning: {
    ...typography.body,
    color: colors.danger,
  },
  watchlistCreatePanel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  watchlistName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  watchlistRow: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  watchlistRows: {
    gap: spacing.sm,
  },
});
