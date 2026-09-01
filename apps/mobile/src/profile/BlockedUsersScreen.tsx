import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { UserX } from 'lucide-react-native';
import {
  type BlockedUser,
  listBlockedUsers,
  unblockUser,
} from '../api/blocks';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { TextInput } from '../components/TextInput';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';

type LoadStatus = 'error' | 'loading' | 'ready';
type PaginationStatus = 'error' | 'idle' | 'loading';

export function BlockedUsersScreen() {
  const { firebaseIdToken } = useAuthSession();
  const [items, setItems] = useState<BlockedUser[]>([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [paginationStatus, setPaginationStatus] = useState<PaginationStatus>('idle');
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setSearchQuery(query.trim()), 250);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let isCurrent = true;

    if (!firebaseIdToken) {
      setItems([]);
      setMessage('Sign in again to manage blocked users.');
      setNextCursor(null);
      setStatus('error');
      return;
    }

    setMessage(null);
    setPaginationStatus('idle');
    setStatus('loading');

    void listBlockedUsers(firebaseIdToken, undefined, searchQuery)
      .then((page) => {
        if (!isCurrent) return;

        setItems(page.items);
        setNextCursor(page.nextCursor);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;

        setItems([]);
        setMessage(error instanceof Error ? error.message : 'Blocked users could not load.');
        setNextCursor(null);
        setStatus('error');
      });

    return () => {
      isCurrent = false;
    };
  }, [firebaseIdToken, loadAttempt, searchQuery]);

  const loadNextPage = useCallback(async () => {
    if (!firebaseIdToken || !nextCursor || paginationStatus === 'loading') return;

    setPaginationStatus('loading');
    try {
      const page = await listBlockedUsers(firebaseIdToken, nextCursor, searchQuery);
      setItems((current) => {
        const existingIds = new Set(current.map((item) => item.userId));
        return [...current, ...page.items.filter((item) => !existingIds.has(item.userId))];
      });
      setNextCursor(page.nextCursor);
      setPaginationStatus('idle');
    } catch {
      setPaginationStatus('error');
    }
  }, [firebaseIdToken, nextCursor, paginationStatus, searchQuery]);

  function clearSearch() {
    setQuery('');
    setSearchQuery('');
  }

  function confirmUnblock(item: BlockedUser) {
    if (unblockingUserId) return;

    Alert.alert(
      `Unblock ${item.displayName}?`,
      `${item.displayName} will be able to find your profile and interact with you again.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => { void performUnblock(item); },
          style: 'destructive',
          text: 'Unblock',
        },
      ],
    );
  }

  async function performUnblock(item: BlockedUser) {
    if (!firebaseIdToken || unblockingUserId) return;

    setUnblockingUserId(item.userId);
    try {
      await unblockUser(firebaseIdToken, item.userId);
      setItems((current) => current.filter((currentItem) => currentItem.userId !== item.userId));
      if (items.length === 1 && nextCursor) {
        await loadNextPage();
      }
      hapticSuccess();
    } catch (error) {
      hapticError();
      Alert.alert(
        'Could not unblock user',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    } finally {
      setUnblockingUserId(null);
    }
  }

  return (
    <Screen title="">
      <View style={styles.page}>
        <TextInput
          accessibilityLabel="Search blocked users"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          clearButtonMode="while-editing"
          inputMode="search"
          label="Search blocked users"
          maxLength={80}
          onChangeText={setQuery}
          placeholder="Name or @handle"
          returnKeyType="search"
          spellCheck={false}
          value={query}
        />
        {status === 'loading' ? (
          <LoadingState label="Loading blocked users" />
        ) : status === 'error' ? (
          <EmptyState
            body={message ?? 'Check your connection and try again.'}
            illustration={(
              <View style={styles.emptyIcon}>
                <UserX color={colors.accentText} size={34} strokeWidth={1.8} />
              </View>
            )}
            title="Blocked users unavailable"
          >
            <Button compact label="Try again" onPress={() => setLoadAttempt((value) => value + 1)} />
          </EmptyState>
        ) : items.length === 0 && !nextCursor ? (
          <EmptyState
            body={searchQuery
              ? 'Try a different name or handle.'
              : 'People you block will appear here.'}
            illustration={(
              <View style={styles.emptyIcon}>
                <UserX color={colors.accentText} size={34} strokeWidth={1.8} />
              </View>
            )}
            title={searchQuery ? 'No blocked users found' : 'No blocked users'}
          >
            {searchQuery ? (
              <Button compact label="Clear search" onPress={clearSearch} variant="secondary" />
            ) : null}
          </EmptyState>
        ) : (
          <>
            <Text style={styles.intro}>
              Blocked people cannot follow you or interact with your Watchly activity.
            </Text>
            {items.length > 0 ? (
              <View style={styles.list}>
                {items.map((item, index) => (
                  <View
                    key={item.userId}
                    style={[styles.row, index < items.length - 1 ? styles.rowDivider : null]}
                  >
                    <UserAvatar avatarUrl={item.avatarUrl} displayName={item.displayName} size={48} />
                    <View style={styles.copy}>
                      <Text numberOfLines={1} style={styles.name}>{item.displayName}</Text>
                      {item.handle ? (
                        <Text numberOfLines={1} style={styles.handle}>@{item.handle}</Text>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityLabel={`Unblock ${item.displayName}`}
                      accessibilityRole="button"
                      accessibilityState={{
                        busy: unblockingUserId === item.userId,
                        disabled: unblockingUserId !== null,
                      }}
                      disabled={unblockingUserId !== null}
                      onPress={() => confirmUnblock(item)}
                      style={({ pressed }) => [
                        styles.unblockButton,
                        pressed ? styles.pressed : null,
                        unblockingUserId && unblockingUserId !== item.userId ? styles.disabled : null,
                      ]}
                    >
                      {unblockingUserId === item.userId ? (
                        <ActivityIndicator color={colors.danger} size="small" />
                      ) : (
                        <Text style={styles.unblockLabel}>Unblock</Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {paginationStatus === 'loading' ? (
              <View accessibilityLiveRegion="polite" style={styles.paginationState}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={styles.paginationText}>Loading more</Text>
              </View>
            ) : paginationStatus === 'error' ? (
              <View accessibilityLiveRegion="polite" style={styles.paginationState}>
                <Text style={styles.paginationText}>Could not load more blocked users.</Text>
                <Button compact label="Retry" onPress={() => { void loadNextPage(); }} variant="secondary" />
              </View>
            ) : nextCursor ? (
              <View style={styles.paginationState}>
                <Button
                  compact
                  label="Load more"
                  onPress={() => { void loadNextPage(); }}
                  variant="secondary"
                />
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    minWidth: 0,
  },
  disabled: {
    opacity: 0.48,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 34,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  handle: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  intro: {
    ...typography.body,
    color: colors.textMuted,
  },
  list: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  page: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  paginationState: {
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: touchTargets.min,
  },
  paginationText: {
    ...typography.meta,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unblockButton: {
    alignItems: 'center',
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: touchTargets.min,
    minWidth: 86,
    paddingHorizontal: spacing.sm,
  },
  unblockLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
});
