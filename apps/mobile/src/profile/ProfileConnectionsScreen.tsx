import { useCallback, useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getProfileConnections, type ProfileSearchItem } from '../api/profile';
import { useAuthSession, useSocialRevision } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { ProfileHeaderButton } from './ProfileHeaderButton';

type ProfileConnectionsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ProfileConnections'
>;

export function ProfileConnectionsScreen({ navigation, route }: ProfileConnectionsScreenProps) {
  const { currentUser, firebaseIdToken } = useAuthSession();
  const socialRevision = useSocialRevision();
  const [items, setItems] = useState<ProfileSearchItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>('loading');
  const { kind, userId } = route.params;
  const title = kind === 'followers' ? 'Followers' : 'Following';

  useEffect(() => {
    let isCurrent = true;

    if (!firebaseIdToken) {
      setStatus('error');
      setMessage('Sign in again to view this list.');
      return;
    }

    setStatus('loading');
    setMessage(null);

    getProfileConnections(firebaseIdToken, userId, kind)
      .then((response) => {
        if (!isCurrent) return;

        setItems(response.items);
        setStatus('ready');
      })
      .catch((error) => {
        if (!isCurrent) return;

        setItems([]);
        setMessage(error instanceof Error ? error.message : 'This list could not load.');
        setStatus('error');
      });

    return () => {
      isCurrent = false;
    };
  }, [firebaseIdToken, kind, revision, socialRevision, userId]);

  const openProfile = useCallback((item: ProfileSearchItem) => {
    navigation.push('PublicProfile', {
      profilePreview: {
        avatarUrl: item.avatarUrl,
        displayName: item.displayName,
        handle: item.handle,
      },
      previewOwnProfile: item.id === currentUser?.id,
      userId: item.id,
    });
  }, [currentUser?.id, navigation]);

  const leading = (
    <ProfileHeaderButton accessibilityLabel="Back" onPress={() => navigation.goBack()}>
      <ChevronLeft color={colors.text} size={30} strokeWidth={2} />
    </ProfileHeaderButton>
  );

  return (
    <Screen leading={leading} title={title}>
      {status === 'loading' ? (
        <LoadingState label={`Loading ${kind}`} />
      ) : status === 'error' ? (
        <EmptyState body={message ?? 'Try again later.'} title="List unavailable">
          <Button compact label="Retry" onPress={() => setRevision((value) => value + 1)} />
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState
          body={kind === 'followers'
            ? 'Accepted followers will appear here.'
            : 'Profiles followed by this member will appear here.'}
          illustration={(
            <View style={styles.emptyIcon}>
              <Users color={colors.accentText} size={34} strokeWidth={1.8} />
            </View>
          )}
          title={kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
        />
      ) : (
        <View style={styles.list}>
          {items.map((item, index) => (
            <Pressable
              accessibilityHint="Opens this Watchly profile."
              accessibilityLabel={`Open ${item.displayName}, @${item.handle}`}
              accessibilityRole="button"
              key={item.id}
              onPress={() => openProfile(item)}
              style={({ pressed }) => [
                styles.row,
                index < items.length - 1 ? styles.rowDivider : null,
                pressed ? styles.rowPressed : null,
              ]}
            >
              <UserAvatar avatarUrl={item.avatarUrl} displayName={item.displayName} size={52} />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.name}>{item.displayName}</Text>
                <Text numberOfLines={1} style={styles.handle}>@{item.handle}</Text>
              </View>
              <ChevronRight color={colors.textSubtle} size={20} strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    minWidth: 0,
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
    fontSize: 14,
    fontWeight: '600',
    marginTop: 3,
  },
  list: {
    marginTop: spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    opacity: 0.62,
  },
});
