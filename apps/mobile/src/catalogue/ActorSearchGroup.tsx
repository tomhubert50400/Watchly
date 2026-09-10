import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { searchActors, type CatalogueActor } from '../api/catalogue';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';

export function useActorSearch(query: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; items: CatalogueActor[]; error: string | null } | null>(null);
  const key = JSON.stringify([query, revision]);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      void searchActors(query).then(response => {
        if (current) setResult({ key, items: response.items, error: null });
      }).catch((error: unknown) => {
        if (current) setResult({ key, items: [], error: error instanceof Error ? error.message : 'Actor search failed.' });
      });
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [key, query]);
  const visible = result?.key === key ? result : null;
  return { items: visible?.items ?? [], error: visible?.error ?? null, isLoading: !visible, retry: () => setRevision(value => value + 1) };
}

export function ActorSearchGroup({ items }: { items: readonly CatalogueActor[] }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Actors</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.rail}>
        {items.map(actor => (
          <Pressable key={actor.tmdbId} accessibilityRole="button" accessibilityLabel={`Open actor ${actor.name}`} onPress={() => {
            Keyboard.dismiss();
            navigation.navigate('ActorDetail', { name: actor.name, tmdbId: actor.tmdbId });
          }} style={({ pressed }) => [styles.actor, pressed && styles.pressed]}>
            <UserAvatar avatarUrl={actor.profileUrl} displayName={actor.name} size={72} />
            <Text numberOfLines={2} style={styles.name}>{actor.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  heading: { ...typography.title, color: colors.text },
  rail: { gap: spacing.md },
  actor: { width: 88, alignItems: 'center', gap: spacing.sm },
  name: { ...typography.meta, color: colors.text, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
