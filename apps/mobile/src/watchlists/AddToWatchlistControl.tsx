import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookmarkPlus, Plus, Sparkles } from 'lucide-react-native';
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
import { SignInSheet } from '../auth/SignInRequired';
import { BottomActionSheet } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticConfirm, hapticError, hapticSelection, hapticSuccess } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import { useWatchlistCache } from './WatchlistCacheContext';
import { WatchlistOption, WatchlistOptionRow } from './WatchlistOptionRow';
import {
  autoSelectCreatedWatchlist,
  buildSelectionDiff,
  buildSelectionLabel,
  rollbackSelection,
} from './watchlistSelection';

type AddToWatchlistControlProps = {
  contentType: WatchlistContentType;
  tmdbId: number;
};

type CreateWatchlistKind = 'personal' | 'shared';

export function AddToWatchlistControl({ contentType, tmdbId }: AddToWatchlistControlProps) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const { preloadWatchlists } = useWatchlistCache();
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [initialSelectedKeys, setInitialSelectedKeys] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [newWatchlistKind, setNewWatchlistKind] = useState<CreateWatchlistKind>('personal');
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [optionsContentKey, setOptionsContentKey] = useState<string | null>(null);
  const [options, setOptions] = useState<WatchlistOption[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const loadVersionRef = useRef(0);
  const saveVersionRef = useRef(0);
  const contentKey = `${contentType}:${tmdbId}`;
  const optionsOwnerKey = `${currentUser?.id ?? 'signed-out'}:${contentKey}`;

  const loadOptions = useCallback(async (showLoading: boolean) => {
    if (!firebaseIdToken) return;

    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;
    if (showLoading) setIsLoading(true);

    try {
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

      if (loadVersionRef.current !== loadVersion) return;
      setOptions(nextOptions);
      setOptionsContentKey(optionsOwnerKey);
      setInitialSelectedKeys(nextSelectedKeys);
      setSelectedKeys(rollbackSelection(nextSelectedKeys));
    } catch (loadError) {
      if (loadVersionRef.current === loadVersion) {
        setOptions([]);
        setOptionsContentKey(optionsOwnerKey);
        setInitialSelectedKeys(new Set());
        setSelectedKeys(new Set());
        showToast(loadError instanceof Error ? loadError.message : 'Could not load watchlists.');
      }
    } finally {
      if (loadVersionRef.current === loadVersion) setIsLoading(false);
    }
  }, [contentType, firebaseIdToken, getFirebaseIdToken, optionsOwnerKey, showToast, tmdbId]);

  useEffect(() => {
    saveVersionRef.current += 1;
    setIsOpen(false);
    setIsSaving(false);
    setIsSignInOpen(false);
  }, [optionsOwnerKey]);

  useEffect(() => {
    if (!firebaseIdToken) {
      setOptions([]);
      setOptionsContentKey(null);
      setInitialSelectedKeys(new Set());
      setSelectedKeys(new Set());
      return;
    }

    void loadOptions(false);
  }, [firebaseIdToken, loadOptions]);

  function openSheet() {
    if (!firebaseIdToken || isSaving) return;

    setSelectedKeys(rollbackSelection(initialSelectedKeys));
    setIsCreateFormOpen(false);
    setNewWatchlistKind('personal');
    setNewWatchlistName('');
    setIsOpen(true);

    if (optionsContentKey !== optionsOwnerKey) {
      setOptions([]);
      setInitialSelectedKeys(new Set());
      setSelectedKeys(new Set());
      void loadOptions(true);
    }
  }

  function dismissSheet() {
    setSelectedKeys(rollbackSelection(initialSelectedKeys));
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

      setOptions((current) => [option, ...current.filter((item) => item.key !== option.key)]);
      setSelectedKeys((current) => autoSelectCreatedWatchlist(current, option.key));
      setIsCreateFormOpen(false);
      setNewWatchlistName('');
      hapticSuccess();
    } catch (createError) {
      hapticError();
      showToast(createError instanceof Error ? createError.message : 'Could not create this watchlist.');
    } finally {
      setIsCreating(false);
    }
  }

  function toggleOption(key: string) {
    hapticSelection();
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function saveSelection() {
    if (!firebaseIdToken || isSaving) return;

    const previousInitialKeys = rollbackSelection(initialSelectedKeys);
    const previousOptions = options;
    const nextSelectedKeys = rollbackSelection(selectedKeys);
    const saveOptions = options;
    const diff = buildSelectionDiff(previousInitialKeys, nextSelectedKeys);
    if (diff.addedKeys.length === 0 && diff.removedKeys.length === 0) return;

    const addedKeys = new Set(diff.addedKeys);
    const removedKeys = new Set(diff.removedKeys);
    const saveVersion = saveVersionRef.current + 1;
    saveVersionRef.current = saveVersion;

    setInitialSelectedKeys(nextSelectedKeys);
    setOptions((current) => updateOptionSelection(current, previousInitialKeys, nextSelectedKeys));
    setIsSaving(true);
    setIsOpen(false);
    const completedRollbacks: Array<() => Promise<unknown>> = [];

    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to update watchlists.');

      const operations: Array<{
        rollback: () => Promise<unknown>;
        run: () => Promise<unknown>;
      }> = [];

      saveOptions.forEach((option) => {
        if (addedKeys.has(option.key)) {
          operations.push(option.kind === 'personal'
            ? {
                rollback: () => removeWatchlistItem(token, option.id, contentType, tmdbId),
                run: () => addWatchlistItem(token, option.id, { contentType, tmdbId }),
              }
            : {
                rollback: () => removeSharedWatchlistItem(token, option.id, contentType, tmdbId),
                run: () => addSharedWatchlistItem(token, option.id, { contentType, tmdbId }),
              });
        }
        if (removedKeys.has(option.key)) {
          operations.push(option.kind === 'personal'
            ? {
                rollback: () => addWatchlistItem(token, option.id, { contentType, tmdbId }),
                run: () => removeWatchlistItem(token, option.id, contentType, tmdbId),
              }
            : {
                rollback: () => addSharedWatchlistItem(token, option.id, { contentType, tmdbId }),
                run: () => removeSharedWatchlistItem(token, option.id, contentType, tmdbId),
              });
        }
      });

      for (const operation of operations) {
        await operation.run();
        completedRollbacks.unshift(operation.rollback);
      }

      void preloadWatchlists();
      showToast('Watchlists updated.', 'success');
      hapticConfirm();
    } catch (saveError) {
      const compensationResults = await Promise.allSettled(
        completedRollbacks.map((rollback) => rollback()),
      );
      const rollbackComplete = compensationResults.every((result) => result.status === 'fulfilled');

      if (saveVersionRef.current === saveVersion) {
        hapticError();
        setIsOpen(true);
        if (rollbackComplete) {
          setOptions(previousOptions);
          setInitialSelectedKeys(previousInitialKeys);
          setSelectedKeys(rollbackSelection(previousInitialKeys));
          showToast(saveError instanceof Error ? saveError.message : 'Could not update watchlists.');
        } else {
          await loadOptions(false);
          showToast('Some list changes could not be rolled back. Showing the latest server state.');
        }
      }
    } finally {
      if (saveVersionRef.current === saveVersion) setIsSaving(false);
    }
  }

  const hasCurrentOptions = optionsContentKey === optionsOwnerKey;
  const diff = buildSelectionDiff(initialSelectedKeys, selectedKeys);
  const hasChanges = diff.addedKeys.length > 0 || diff.removedKeys.length > 0;
  const hasSharedOptions = options.some((option) => option.kind === 'shared');
  const saveLabel = buildSelectionLabel(initialSelectedKeys, selectedKeys);

  const footer = (
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
              editable={!isCreating && !isSaving}
              onChangeText={setNewWatchlistName}
              onSubmitEditing={createWatchlistFromSheet}
              placeholder={newWatchlistKind === 'personal' ? 'New personal list' : 'New shared list'}
              placeholderTextColor={colors.textSubtle}
              returnKeyType="done"
              style={styles.createInput}
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

      <Button
        disabled={isLoading || isCreating || !hasCurrentOptions || !hasChanges}
        fullWidth
        label={saveLabel}
        loading={isSaving}
        onPress={saveSelection}
      />
    </View>
  );

  return (
    <>
      <Pressable
        accessibilityLabel={firebaseIdToken ? 'Add to watchlist' : 'Sign in to add to watchlist'}
        accessibilityRole="button"
        accessibilityState={{ busy: isSaving, disabled: isSaving }}
        disabled={isSaving}
        onPress={() => firebaseIdToken ? openSheet() : setIsSignInOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          pressed && !isSaving ? styles.pressed : null,
          isSaving ? styles.disabled : null,
        ]}
      >
        {isSaving ? (
          <ActivityIndicator color={colors.accentText} size="small" />
        ) : (
          <BookmarkPlus color={colors.accentText} size={16} strokeWidth={2.4} />
        )}
        <Text style={styles.triggerLabel}>Add to watchlist</Text>
      </Pressable>

      <BottomActionSheet footer={footer} onClose={dismissSheet} title="Add to a list" visible={isOpen}>
        <Text style={styles.sheetSubtitle}>Select one or more lists.</Text>

        {isLoading || !hasCurrentOptions ? (
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
          <ScrollView contentContainerStyle={styles.optionList} showsVerticalScrollIndicator={false}>
            {options.map((option) => (
              <WatchlistOptionRow
                isSelected={selectedKeys.has(option.key)}
                key={option.key}
                onPress={() => toggleOption(option.key)}
                option={option}
              />
            ))}
            {hasSharedOptions ? (
              <View style={styles.voteNote}>
                <Sparkles color={colors.accentText} size={18} strokeWidth={2} />
                <Text style={styles.voteNoteText}>
                  <Text style={styles.voteNoteStrong}>Shared lists: </Text>
                  voting becomes available after this title is added.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        )}
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
    ...typography.body,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
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
  disabled: {
    opacity: 0.48,
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
  optionList: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: spacing.md,
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
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  triggerLabel: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '800',
  },
  voteNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.panelElevated,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    padding: spacing.md,
  },
  voteNoteStrong: {
    color: colors.accentText,
    fontWeight: '800',
  },
  voteNoteText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});
