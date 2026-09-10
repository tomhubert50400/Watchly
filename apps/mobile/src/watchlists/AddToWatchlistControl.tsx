import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookmarkPlus, Plus } from 'lucide-react-native';
import {
  addSharedWatchlistItem,
  createSharedWatchlist,
  listSharedWatchlists,
  removeSharedWatchlistItem,
  SharedWatchlistSummary,
} from '../api/sharedWatchlists';
import {
  addWatchlistItem,
  createWatchlist,
  listWatchlists,
  PersonalWatchlistSummary,
  removeWatchlistItem,
  WatchlistContentType,
} from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import {
  getPrivateCacheKey,
  readPersistedCache,
  writePersistedCache,
} from '../cache/persistedCache';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { SignInSheet } from '../auth/SignInRequired';
import {
  BottomActionSheet,
  BottomActionSheetScrollView,
} from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { useWatchlistCache } from './WatchlistCacheContext';
import { WatchlistOption, WatchlistOptionRow } from './WatchlistOptionRow';
import { loadProgressively, takeHydrationItems } from './requestBoundaries';
import { loadWatchlistPreviewUrls } from './watchlistPreview';
import {
  autoSelectCreatedWatchlist,
  rollbackSelection,
} from './watchlistSelection';

type AddToWatchlistControlProps = {
  contentType: WatchlistContentType;
  tmdbId: number;
};

type CreateWatchlistKind = 'personal' | 'shared';

const MAX_WATCHLIST_PREVIEWS = 12;
const MAX_CONCURRENT_WATCHLIST_PREVIEWS = 2;

export function AddToWatchlistControl({ contentType, tmdbId }: AddToWatchlistControlProps) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const { showToast } = useToast();
  const { preloadWatchlists } = useWatchlistCache();
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [newWatchlistKind, setNewWatchlistKind] = useState<CreateWatchlistKind>('personal');
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [optionsContentKey, setOptionsContentKey] = useState<string | null>(null);
  const [options, setOptions] = useState<WatchlistOption[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const loadVersionRef = useRef(0);
  const previewArtworkCacheRef = useRef(new Map<string, string | null>());
  const previewHydrationCacheRef = useRef(new Map<string, string>());
  const previewVersionRef = useRef(0);
  const confirmedSelectedKeysRef = useRef(new Set<string>());
  const optionMutationQueuesRef = useRef(new Map<string, Promise<void>>());
  const optionPendingCountsRef = useRef(new Map<string, number>());
  const optionsRef = useRef(options);
  const selectedKeysRef = useRef(selectedKeys);
  const contentKey = `${contentType}:${tmdbId}`;
  const optionsOwnerKey = `${currentUser?.id ?? 'signed-out'}:${contentKey}`;
  const optionsCacheKey = currentUser
    ? getPrivateCacheKey(currentUser.id, `watchlist-options:${contentKey}`)
    : null;
  const previewOwnerKeyRef = useRef(optionsOwnerKey);
  selectedKeysRef.current = selectedKeys;
  optionsRef.current = options;

  if (previewOwnerKeyRef.current !== optionsOwnerKey) {
    previewOwnerKeyRef.current = optionsOwnerKey;
    previewVersionRef.current += 1;
  }

  const loadPreviewArtwork = useCallback(async (item: {
    contentType: WatchlistContentType;
    tmdbId: number;
  }) => {
    const key = `${item.contentType}:${item.tmdbId}`;

    if (previewArtworkCacheRef.current.has(key)) {
      return previewArtworkCacheRef.current.get(key) ?? null;
    }

    const details = item.contentType === 'movie'
      ? await refreshMovie(item.tmdbId)
      : await refreshSeries(item.tmdbId);
    const artworkUrl = details.backdropUrl ?? details.posterUrl;
    previewArtworkCacheRef.current.set(key, artworkUrl);

    return artworkUrl;
  }, [refreshMovie, refreshSeries]);

  const loadOptionPreviews = useCallback(async (
    sourceOptions: WatchlistOption[],
    expectedOwnerKey: string,
  ) => {
    const previewVersion = previewVersionRef.current + 1;
    previewVersionRef.current = previewVersion;
    const pendingOptions = takeHydrationItems(
      sourceOptions.filter((option) => (
        previewHydrationCacheRef.current.get(option.key) !== option.updatedAt
      )),
      MAX_WATCHLIST_PREVIEWS,
    );
    if (pendingOptions.length === 0) return;

    const token = await getFirebaseIdToken();

    if (!token || previewOwnerKeyRef.current !== expectedOwnerKey) return;

    await loadProgressively({
      concurrency: MAX_CONCURRENT_WATCHLIST_PREVIEWS,
      items: pendingOptions,
      load: async (option) => loadWatchlistPreviewUrls({
        fallback: option.posterUrls,
        list: option,
        loadArtwork: loadPreviewArtwork,
        token,
      }),
      onLoaded: (posterUrls, loadedOption) => {
        if (
          previewVersionRef.current !== previewVersion
          || previewOwnerKeyRef.current !== expectedOwnerKey
        ) return;

        previewHydrationCacheRef.current.set(loadedOption.key, loadedOption.updatedAt);
        setOptions((current) => current.map((option) => (
          option.key === loadedOption.key && option.updatedAt === loadedOption.updatedAt
            ? { ...option, posterUrls }
            : option
        )));
      },
    });
  }, [getFirebaseIdToken, loadPreviewArtwork]);

  const loadOptions = useCallback(async (showLoading: boolean, loadPreviews = false) => {
    if (!firebaseIdToken) return;

    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;
    if (showLoading) setIsLoading(true);

    try {
      if (optionsCacheKey) {
        const cached = await readPersistedCache<WatchlistOption[]>(optionsCacheKey).catch(() => null);
        if (cached && loadVersionRef.current === loadVersion) {
          const cachedSelectedKeys = new Set(
            cached.data.filter((option) => option.containsTitle).map((option) => option.key),
          );
          optionsRef.current = cached.data;
          confirmedSelectedKeysRef.current = cachedSelectedKeys;
          selectedKeysRef.current = rollbackSelection(cachedSelectedKeys);
          setOptions(cached.data);
          setOptionsContentKey(optionsOwnerKey);
          setSelectedKeys(rollbackSelection(cachedSelectedKeys));
        }
      }
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to load watchlists.');

      const [personalResponse, sharedResponse] = await Promise.all([
        listWatchlists(token, { contentType, tmdbId }),
        listSharedWatchlists(token, { contentType, tmdbId }),
      ]);
      const nextOptions = [
        ...personalResponse.items.map(toPersonalOption),
        ...sharedResponse.items.map(toSharedOption),
      ];
      const nextSelectedKeys = new Set(
        nextOptions.filter((option) => option.containsTitle).map((option) => option.key),
      );

      if (loadVersionRef.current !== loadVersion || optionPendingCountsRef.current.size > 0) return;
      const hydratedOptions = nextOptions.map((option) => ({
        ...option,
        posterUrls: optionsRef.current.find((item) => (
          item.key === option.key && item.updatedAt === option.updatedAt
        ))?.posterUrls ?? option.posterUrls,
      }));
      optionsRef.current = hydratedOptions;
      setOptions(hydratedOptions);
      setOptionsContentKey(optionsOwnerKey);
      confirmedSelectedKeysRef.current = nextSelectedKeys;
      selectedKeysRef.current = rollbackSelection(nextSelectedKeys);
      setSelectedKeys(rollbackSelection(nextSelectedKeys));
      if (optionsCacheKey) {
        void writePersistedCache(optionsCacheKey, hydratedOptions).catch(() => undefined);
      }
      if (loadPreviews) void loadOptionPreviews(nextOptions, optionsOwnerKey);
    } catch (loadError) {
      if (loadVersionRef.current === loadVersion) {
        showToast(loadError instanceof Error ? loadError.message : 'Could not load watchlists.');
      }
    } finally {
      if (loadVersionRef.current === loadVersion) setIsLoading(false);
    }
  }, [contentType, firebaseIdToken, getFirebaseIdToken, loadOptionPreviews, optionsCacheKey, optionsOwnerKey, showToast, tmdbId]);

  useEffect(() => {
    optionsRef.current = [];
    confirmedSelectedKeysRef.current = new Set();
    selectedKeysRef.current = new Set();
    setIsOpen(false);
    setIsSignInOpen(false);
  }, [optionsOwnerKey]);

  useEffect(() => {
    if (!firebaseIdToken) {
      optionsRef.current = [];
      confirmedSelectedKeysRef.current = new Set();
      selectedKeysRef.current = new Set();
      setOptions([]);
      setOptionsContentKey(null);
      confirmedSelectedKeysRef.current = new Set();
      setSelectedKeys(new Set());
      return;
    }

    void loadOptions(false);
  }, [firebaseIdToken, loadOptions]);

  function openSheet() {
    if (!firebaseIdToken) return;

    setIsCreateFormOpen(false);
    setNewWatchlistKind('personal');
    setNewWatchlistName('');
    setIsOpen(true);

    if (optionsContentKey !== optionsOwnerKey) {
      setOptions([]);
      confirmedSelectedKeysRef.current = new Set();
      setSelectedKeys(new Set());
      void loadOptions(true, true);
    } else {
      void loadOptionPreviews(options, optionsOwnerKey);
    }
  }

  function dismissSheet() {
    setIsCreateFormOpen(false);
    setNewWatchlistName('');
    setIsOpen(false);
  }

  async function createWatchlistFromSheet() {
    const name = newWatchlistName.trim();
    if (!firebaseIdToken || name.length === 0 || isCreating) return;

    setIsCreating(true);
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to create a watchlist.');

      const option = newWatchlistKind === 'personal'
        ? toPersonalOption({ ...(await createWatchlist(token, name)), containsTitle: false })
        : toSharedOption({ ...(await createSharedWatchlist(token, name)), containsTitle: false });
      if (option.kind === 'personal') {
        await addWatchlistItem(token, option.id, { contentType, tmdbId });
      } else {
        await addSharedWatchlistItem(token, option.id, { contentType, tmdbId });
      }

      const selectedOption = {
        ...option,
        containsTitle: true,
        itemCount: option.itemCount + 1,
      };
      const nextSelected = autoSelectCreatedWatchlist(selectedKeysRef.current, option.key);
      const nextOptions = [selectedOption, ...optionsRef.current.filter((item) => item.key !== option.key)];
      selectedKeysRef.current = nextSelected;
      confirmedSelectedKeysRef.current = nextSelected;
      optionsRef.current = nextOptions;
      setOptions(nextOptions);
      setSelectedKeys(nextSelected);
      if (optionsCacheKey) void writePersistedCache(optionsCacheKey, nextOptions).catch(() => undefined);
      setIsCreateFormOpen(false);
      setNewWatchlistName('');
      void preloadWatchlists();
      notifyUserDataChanged('watchlists');
      hapticSuccess();
    } catch (createError) {
      hapticError();
      showToast(createError instanceof Error ? createError.message : 'Could not create this watchlist.');
    } finally {
      setIsCreating(false);
    }
  }

  function toggleOption(key: string) {
    const option = options.find((item) => item.key === key);
    if (!option) return;
    const previousSelected = rollbackSelection(selectedKeysRef.current);
    const nextContainsTitle = !previousSelected.has(key);
    const nextSelected = rollbackSelection(previousSelected);
    if (nextContainsTitle) nextSelected.add(key);
    else nextSelected.delete(key);
    selectedKeysRef.current = nextSelected;
    setSelectedKeys(nextSelected);
    const optimisticOptions = updateOptionSelection(optionsRef.current, previousSelected, nextSelected);
    optionsRef.current = optimisticOptions;
    setOptions(optimisticOptions);
    if (optionsCacheKey) void writePersistedCache(optionsCacheKey, optimisticOptions).catch(() => undefined);
    optionPendingCountsRef.current.set(key, (optionPendingCountsRef.current.get(key) ?? 0) + 1);

    const commitMutation = async () => {
      try {
        const token = await getFirebaseIdToken();
        if (!token) throw new Error('Sign in again to update watchlists.');
        if (option.kind === 'personal') {
          if (nextContainsTitle) await addWatchlistItem(token, option.id, { contentType, tmdbId });
          else await removeWatchlistItem(token, option.id, contentType, tmdbId);
        } else if (nextContainsTitle) {
          await addSharedWatchlistItem(token, option.id, { contentType, tmdbId });
        } else {
          await removeSharedWatchlistItem(token, option.id, contentType, tmdbId);
        }
        const confirmed = rollbackSelection(confirmedSelectedKeysRef.current);
        if (nextContainsTitle) confirmed.add(key);
        else confirmed.delete(key);
        confirmedSelectedKeysRef.current = confirmed;
        previewHydrationCacheRef.current.delete(key);
        void preloadWatchlists();
        notifyUserDataChanged('watchlists');
      } catch (saveError) {
        hapticError();
        showToast(saveError instanceof Error ? saveError.message : 'Could not update watchlists.');
      } finally {
        const pendingCount = (optionPendingCountsRef.current.get(key) ?? 1) - 1;
        if (pendingCount > 0) {
          optionPendingCountsRef.current.set(key, pendingCount);
        } else {
          optionPendingCountsRef.current.delete(key);
          const confirmedContainsTitle = confirmedSelectedKeysRef.current.has(key);
          const previousSelected = rollbackSelection(selectedKeysRef.current);
          const reconciled = rollbackSelection(selectedKeysRef.current);
          if (confirmedContainsTitle) reconciled.add(key);
          else reconciled.delete(key);
          selectedKeysRef.current = reconciled;
          setSelectedKeys(reconciled);
          const reconciledOptions = updateOptionSelection(optionsRef.current, previousSelected, reconciled);
          optionsRef.current = reconciledOptions;
          setOptions(reconciledOptions);
          if (optionsCacheKey) {
            void writePersistedCache(optionsCacheKey, reconciledOptions).catch(() => undefined);
          }
        }
      }
    };
    const previousQueue = optionMutationQueuesRef.current.get(key) ?? Promise.resolve();
    const queuedMutation = previousQueue.then(commitMutation, commitMutation);
    optionMutationQueuesRef.current.set(key, queuedMutation.catch(() => undefined));
  }

  const hasCurrentOptions = optionsContentKey === optionsOwnerKey;
  const personalOptions = options.filter((option) => option.kind === 'personal');
  const sharedOptions = options.filter((option) => option.kind === 'shared');

  const createForm = (
    <View style={styles.footer}>
      {isCreateFormOpen ? (
        <View style={styles.createPanel}>
          <SegmentedControl
            buttonMinHeight={44}
            onChange={setNewWatchlistKind}
            options={[
              { label: 'Personal', value: 'personal' },
              { label: 'Shared', value: 'shared' },
            ]}
            value={newWatchlistKind}
          />
          <View style={styles.createRow}>
            <TextInput
              accessibilityLabel="New watchlist name"
              editable={!isCreating}
              onChangeText={setNewWatchlistName}
              onSubmitEditing={createWatchlistFromSheet}
              placeholder={newWatchlistKind === 'personal' ? 'New personal list' : 'New shared list'}
              placeholderTextColor={colors.textSubtle}
              returnKeyType="done"
              style={styles.createInput}
              textAlignVertical="center"
              value={newWatchlistName}
            />
            <Button
              disabled={newWatchlistName.trim().length === 0}
              label="Create"
              loading={isCreating}
              onPress={createWatchlistFromSheet}
              variant="secondary"
            />
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="Create a new watchlist"
          accessibilityRole="button"
          onPress={() => setIsCreateFormOpen(true)}
          style={({ pressed }) => [styles.newList, pressed ? styles.pressed : null]}
        >
          <Plus color={colors.textMuted} size={18} strokeWidth={2.4} />
          <Text style={styles.newListLabel}>Create a new list</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <>
      <Pressable
        accessibilityLabel={firebaseIdToken ? 'Add to watchlist' : 'Sign in to add to watchlist'}
        accessibilityRole="button"
        accessibilityState={{}}
        onPress={() => firebaseIdToken ? openSheet() : setIsSignInOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          pressed ? styles.pressed : null,
        ]}
      >
        <BookmarkPlus color={colors.accentText} size={16} strokeWidth={2.4} />
        <Text style={styles.triggerLabel}>Add to watchlist</Text>
      </Pressable>

      <BottomActionSheet dragFromHandleOnly onClose={dismissSheet} title="Add to a list" visible={isOpen}>
        <BottomActionSheetScrollView disableScrollViewPanResponder={false} contentContainerStyle={styles.optionSections}>
          <Text style={styles.sheetSubtitle}>Select one or more lists.</Text>

          {(!hasCurrentOptions || (isLoading && options.length === 0)) ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.stateText}>Loading your lists…</Text>
            </View>
          ) : options.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>No lists yet</Text>
              <Text style={styles.stateText}>Create your first personal or shared list below.</Text>
            </View>
          ) : (
            <View style={styles.optionSections}>
              {personalOptions.length > 0 ? (
                <View style={styles.optionSection}>
                  <Text accessibilityRole="header" style={styles.optionSectionTitle}>Personal lists</Text>
                  <BottomActionSheetScrollView
                    contentContainerStyle={styles.optionRail}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.optionScroller}
                  >
                    {personalOptions.map((option) => (
                      <WatchlistOptionRow
                        isSelected={selectedKeys.has(option.key)}
                        key={option.key}
                        onPress={() => toggleOption(option.key)}
                        option={option}
                      />
                    ))}
                  </BottomActionSheetScrollView>
                </View>
              ) : null}
              {sharedOptions.length > 0 ? (
                <View style={[
                  styles.optionSection,
                  personalOptions.length > 0 ? styles.optionSectionSeparated : null,
                ]}>
                  <Text accessibilityRole="header" style={styles.optionSectionTitle}>Shared lists</Text>
                  <BottomActionSheetScrollView
                    contentContainerStyle={styles.optionRail}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.optionScroller}
                  >
                    {sharedOptions.map((option) => (
                      <WatchlistOptionRow
                        isSelected={selectedKeys.has(option.key)}
                        key={option.key}
                        onPress={() => toggleOption(option.key)}
                        option={option}
                      />
                    ))}
                  </BottomActionSheetScrollView>
                </View>
              ) : null}
            </View>
          )}
          {createForm}
        </BottomActionSheetScrollView>
      </BottomActionSheet>
      <SignInSheet
        body="You need to be signed in to add titles to a watchlist. Sign in here to continue."
        onClose={() => setIsSignInOpen(false)}
        title="Sign in to use watchlists"
        visible={isSignInOpen && !firebaseIdToken}
      />
    </>
  );
}

function toPersonalOption(watchlist: PersonalWatchlistSummary): WatchlistOption {
  return {
    containsTitle: Boolean(watchlist.containsTitle),
    id: watchlist.id,
    itemCount: watchlist.itemCount,
    key: `personal:${watchlist.id}`,
    kind: 'personal',
    memberCount: null,
    name: watchlist.name,
    posterUrls: [],
    updatedAt: watchlist.updatedAt,
  };
}

function toSharedOption(watchlist: SharedWatchlistSummary): WatchlistOption {
  return {
    containsTitle: Boolean(watchlist.containsTitle),
    id: watchlist.id,
    itemCount: watchlist.itemCount,
    key: `shared:${watchlist.id}`,
    kind: 'shared',
    memberCount: watchlist.memberCount,
    name: watchlist.name,
    posterUrls: [],
    updatedAt: watchlist.updatedAt,
  };
}

function updateOptionSelection(
  options: WatchlistOption[],
  previousSelectedKeys: ReadonlySet<string>,
  nextSelectedKeys: ReadonlySet<string>,
) {
  return options.map((option) => {
    const wasSelected = previousSelectedKeys.has(option.key);
    const isSelected = nextSelectedKeys.has(option.key);
    const itemDelta = wasSelected === isSelected ? 0 : isSelected ? 1 : -1;

    return {
      ...option,
      containsTitle: isSelected,
      itemCount: Math.max(0, option.itemCount + itemDelta),
    };
  });
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  createInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: typography.body.fontSize,
    letterSpacing: typography.body.letterSpacing,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  createPanel: {
    gap: spacing.sm,
  },
  createRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  footer: {
    gap: spacing.sm,
  },
  newList: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 47,
  },
  newListLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  optionRail: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  optionScroller: {
    flexGrow: 0,
    height: 156,
  },
  optionSection: {
    gap: spacing.sm,
  },
  optionSectionSeparated: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
  },
  optionSections: {
    gap: spacing.xl,
    paddingBottom: spacing.sm,
    paddingTop: spacing.md,
  },
  optionSectionTitle: {
    ...typography.eyebrow,
    color: colors.textSubtle,
  },
  pressed: {
    opacity: 0.76,
  },
  sheetSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    paddingBottom: spacing.xs,
  },
  stateText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  trigger: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.xl,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  triggerLabel: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '800',
  },
});
