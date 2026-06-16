import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BookmarkPlus, CheckCircle2, Circle, Plus, X } from 'lucide-react-native';
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
import { Button } from '../components/Button';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type AddToWatchlistControlProps = {
  contentType: WatchlistContentType;
  tmdbId: number;
};

type WatchlistOption = {
  containsTitle: boolean;
  id: string;
  itemCount: number;
  key: string;
  kind: 'personal' | 'shared';
  memberCount: number | null;
  name: string;
};

type CreateWatchlistKind = 'personal' | 'shared';

export function AddToWatchlistControl({ contentType, tmdbId }: AddToWatchlistControlProps) {
  const { firebaseIdToken, getFirebaseIdToken, notifyTrackingChanged } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [initialSelectedKeys, setInitialSelectedKeys] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newWatchlistKind, setNewWatchlistKind] = useState<CreateWatchlistKind>('personal');
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [options, setOptions] = useState<WatchlistOption[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  async function openModal() {
    if (!firebaseIdToken) {
      return;
    }

    setIsOpen(true);
    setError(null);
    setIsCreateFormOpen(false);
    setIsLoading(true);
    setNewWatchlistKind('personal');
    setNewWatchlistName('');

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to load watchlists.');
      }

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

      setOptions(nextOptions);
      setInitialSelectedKeys(nextSelectedKeys);
      setSelectedKeys(new Set(nextSelectedKeys));
    } catch (loadError) {
      setOptions([]);
      setInitialSelectedKeys(new Set());
      setSelectedKeys(new Set());
      setError(loadError instanceof Error ? loadError.message : 'Could not load watchlists.');
    } finally {
      setIsLoading(false);
    }
  }

  async function createWatchlistFromModal() {
    const name = newWatchlistName.trim();

    if (!firebaseIdToken || name.length === 0 || isCreating) {
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to create a watchlist.');
      }

      const option =
        newWatchlistKind === 'personal'
          ? toPersonalOption({ ...(await createWatchlist(token, name)), containsTitle: false })
          : toSharedOption({ ...(await createSharedWatchlist(token, name)), containsTitle: false });

      setOptions((current) => [option, ...current.filter((item) => item.key !== option.key)]);
      setSelectedKeys((current) => new Set(current).add(option.key));
      setIsCreateFormOpen(false);
      setNewWatchlistName('');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create this watchlist.');
    } finally {
      setIsCreating(false);
    }
  }

  function toggleOption(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  async function saveSelection() {
    if (!firebaseIdToken || isSaving) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to update watchlists.');
      }

      await Promise.all(
        options.map((option) => {
          const wasSelected = initialSelectedKeys.has(option.key);
          const isSelected = selectedKeys.has(option.key);

          if (wasSelected === isSelected) {
            return Promise.resolve();
          }

          if (option.kind === 'personal') {
            return isSelected
              ? addWatchlistItem(token, option.id, { contentType, tmdbId })
              : removeWatchlistItem(token, option.id, contentType, tmdbId);
          }

          return isSelected
            ? addSharedWatchlistItem(token, option.id, { contentType, tmdbId })
            : removeSharedWatchlistItem(token, option.id, contentType, tmdbId);
        }),
      );

      setInitialSelectedKeys(new Set(selectedKeys));
      notifyTrackingChanged();
      setIsOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update watchlists.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Add to watchlist"
        accessibilityRole="button"
        disabled={!firebaseIdToken}
        onPress={openModal}
        style={({ pressed }) => [
          styles.trigger,
          pressed && firebaseIdToken ? styles.triggerPressed : null,
          !firebaseIdToken ? styles.disabled : null,
        ]}
      >
        <BookmarkPlus color={colors.textOnAccent} size={15} strokeWidth={2.4} />
        <Text style={styles.triggerLabel}>Add to watchlist</Text>
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setIsOpen(false)} transparent visible={isOpen}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Add to watchlist</Text>
                <Text style={styles.sheetSubtitle}>Select one or more lists.</Text>
              </View>
              <Pressable
                accessibilityLabel="Close watchlist picker"
                accessibilityRole="button"
                onPress={() => setIsOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.triggerPressed]}
              >
                <X color={colors.text} size={18} strokeWidth={2.4} />
              </Pressable>
            </View>

            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.loadingText}>Loading watchlists</Text>
              </View>
            ) : options.length === 0 ? (
              <Text style={styles.emptyText}>No watchlists yet.</Text>
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
              </ScrollView>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {isCreateFormOpen ? (
              <View style={styles.createPanel}>
                <View style={styles.createKindRow}>
                  <CreateKindButton
                    isSelected={newWatchlistKind === 'personal'}
                    label="Personal"
                    onPress={() => setNewWatchlistKind('personal')}
                  />
                  <CreateKindButton
                    isSelected={newWatchlistKind === 'shared'}
                    label="Shared"
                    onPress={() => setNewWatchlistKind('shared')}
                  />
                </View>
                <View style={styles.createRow}>
                  <TextInput
                    accessibilityLabel="New watchlist name"
                    editable={!isCreating && !isSaving}
                    onChangeText={setNewWatchlistName}
                    onSubmitEditing={createWatchlistFromModal}
                    placeholder={newWatchlistKind === 'personal' ? 'New personal list' : 'New shared list'}
                    placeholderTextColor={colors.muted}
                    returnKeyType="done"
                    style={styles.createInput}
                    value={newWatchlistName}
                  />
                  <Pressable
                    accessibilityLabel="Create watchlist"
                    accessibilityRole="button"
                    disabled={isCreating || newWatchlistName.trim().length === 0}
                    onPress={createWatchlistFromModal}
                    style={({ pressed }) => [
                      styles.createButton,
                      pressed && !isCreating ? styles.triggerPressed : null,
                      (isCreating || newWatchlistName.trim().length === 0) && styles.disabled,
                    ]}
                  >
                    {isCreating ? (
                      <ActivityIndicator color={colors.textOnAccent} />
                    ) : (
                      <Text style={styles.createButtonLabel}>Create</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.footer}>
              <View style={styles.actions}>
                <Button disabled={isSaving} label="Cancel" onPress={() => setIsOpen(false)} variant="secondary" />
                <Button disabled={isLoading || isSaving || isCreating || options.length === 0} label={isSaving ? 'Saving' : 'Save'} onPress={saveSelection} />
              </View>
              <Pressable
                accessibilityLabel="Show create watchlist field"
                accessibilityRole="button"
                disabled={isCreating || isSaving}
                onPress={() => setIsCreateFormOpen(true)}
                style={({ pressed }) => [
                  styles.createFab,
                  pressed && !isCreating && !isSaving ? styles.triggerPressed : null,
                  (isCreating || isSaving) && styles.disabled,
                ]}
              >
                <Plus color={colors.textOnAccent} size={20} strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function CreateKindButton({
  isSelected,
  label,
  onPress,
}: {
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.createKindButton,
        isSelected ? styles.createKindButtonSelected : null,
        pressed ? styles.triggerPressed : null,
      ]}
    >
      <Text style={[styles.createKindLabel, isSelected ? styles.createKindLabelSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function WatchlistOptionRow({
  isSelected,
  onPress,
  option,
}: {
  isSelected: boolean;
  onPress: () => void;
  option: WatchlistOption;
}) {
  const Icon = isSelected ? CheckCircle2 : Circle;

  return (
    <Pressable
      accessibilityLabel={`${isSelected ? 'Remove from' : 'Add to'} ${option.name}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, pressed && styles.triggerPressed]}
    >
      <Icon color={isSelected ? colors.accent : colors.muted} size={19} strokeWidth={2.4} />
      <View style={styles.optionCopy}>
        <Text numberOfLines={1} style={styles.optionName}>
          {option.name}
        </Text>
        <Text style={styles.optionMeta}>{buildOptionMeta(option)}</Text>
      </View>
    </Pressable>
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

function buildOptionMeta(option: WatchlistOption) {
  const titleCount = `${option.itemCount} ${option.itemCount === 1 ? 'title' : 'titles'}`;

  if (option.kind === 'personal') {
    return `Personal / ${titleCount}`;
  }

  return `Shared / ${titleCount} / ${option.memberCount ?? 0} members`;
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  disabled: {
    opacity: 0.48,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 92,
    paddingHorizontal: spacing.md,
  },
  createButtonLabel: {
    color: colors.textOnAccent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  createFab: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  createInput: {
    ...typography.body,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  createKindButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
  },
  createKindButtonSelected: {
    backgroundColor: colors.accent,
  },
  createKindLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  createKindLabelSelected: {
    color: colors.textOnAccent,
  },
  createKindRow: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  createPanel: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  createRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.md,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.text,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionList: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  optionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 2,
  },
  optionName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  optionRow: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  sheet: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    maxHeight: '82%',
    padding: spacing.lg,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetSubtitle: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  sheetTitle: {
    ...typography.title,
    color: colors.text,
  },
  trigger: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  triggerLabel: {
    color: colors.textOnAccent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  triggerPressed: {
    opacity: 0.78,
  },
});
