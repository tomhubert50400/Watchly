import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronDown, ChevronRight, Ellipsis, Plus } from 'lucide-react-native';
import {
  Alert,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  createWatchlistSection,
  deleteWatchlistSection,
  moveWatchlistItemToSection,
  PersonalWatchlist,
  PersonalWatchlistSection,
  updateWatchlistSection,
} from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { SectionHeader } from '../components/SectionHeader';
import { TextInput } from '../components/TextInput';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError, hapticSelection, hapticSuccess } from '../feedback/haptics';
import { RootStackParamList } from '../navigation/types';
import {
  WatchlistDisplayItem,
  WatchlistPage,
  WatchlistPosterGrid,
  WatchlistSection,
} from './WatchlistDetailLayout';
import { WatchlistCoverButton } from './WatchlistCoverButton';
import { HydratedPersonalWatchlistItem, useWatchlistCache } from './WatchlistCacheContext';
import {
  groupPersonalWatchlistItems,
  MAX_PERSONAL_WATCHLIST_SECTIONS,
  PersonalWatchlistItemGroup,
  resolveDestinationSectionId,
  SECTION_PREVIEW_ITEM_COUNT,
} from './watchlistSections';

type PersonalWatchlistScreenProps = NativeStackScreenProps<RootStackParamList, 'PersonalWatchlist'>;
type SectionEditor = { mode: 'create' } | { mode: 'rename'; section: PersonalWatchlistSection };
type ScreenPoint = { x: number; y: number };
type ScreenRect = ScreenPoint & { height: number; width: number };

export function PersonalWatchlistScreen({ navigation, route }: PersonalWatchlistScreenProps) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { getCachedPersonalWatchlist, refreshPersonalWatchlist } = useWatchlistCache();
  const { watchlistId } = route.params;
  const resourceScope = JSON.stringify([currentUser?.id ?? null, watchlistId]);
  const initialCached = getCachedPersonalWatchlist(watchlistId);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [editor, setEditor] = useState<SectionEditor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [hydratedItems, setHydratedItems] = useState<HydratedPersonalWatchlistItem[]>(
    () => initialCached?.hydratedItems ?? [],
  );
  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [moving, setMoving] = useState<{ item: WatchlistDisplayItem; point: ScreenPoint } | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [stateScope, setStateScope] = useState(resourceScope);
  const [watchlist, setWatchlist] = useState<PersonalWatchlist | null>(() => initialCached?.watchlist ?? null);
  const overlayOriginRef = useRef<ScreenPoint>({ x: 0, y: 0 });
  const overlayRef = useRef<View>(null);
  const requestRef = useRef({ scope: resourceScope, version: 0 });
  const targetRectsRef = useRef(new Map<string, ScreenRect>());
  const targetViewsRef = useRef(new Map<string, View>());
  const visibleStateRef = useRef({ scope: stateScope, watchlist });
  visibleStateRef.current = { scope: stateScope, watchlist };

  if (requestRef.current.scope !== resourceScope) {
    requestRef.current = { scope: resourceScope, version: requestRef.current.version + 1 };
  }

  const isStateCurrent = stateScope === resourceScope;
  const visibleWatchlist = isStateCurrent ? watchlist : null;
  const visibleItems = isStateCurrent ? hydratedItems : [];
  const visibleSections = visibleWatchlist?.sections ?? [];
  const groups = useMemo(
    () => groupPersonalWatchlistItems(visibleSections, visibleItems),
    [visibleItems, visibleSections],
  );

  const loadWatchlist = useCallback(async () => {
    const requestScope = resourceScope;
    const requestVersion = requestRef.current.version + 1;
    requestRef.current = { scope: requestScope, version: requestVersion };
    const isCurrent = () => requestRef.current.scope === requestScope
      && requestRef.current.version === requestVersion;

    if (!firebaseIdToken || !currentUser) {
      setError(null);
      setHydratedItems([]);
      setIsLoading(false);
      setWatchlist(null);
      setStateScope(requestScope);
      return;
    }

    setError(null);
    setIsLoading(!visibleStateRef.current.watchlist);

    try {
      const cached = await refreshPersonalWatchlist(watchlistId);
      if (!isCurrent()) return;

      setHydratedItems(cached.hydratedItems);
      setWatchlist(cached.watchlist);
      setStateScope(requestScope);
    } catch (loadError) {
      if (!isCurrent()) return;
      setError(loadError instanceof Error ? loadError.message : 'Could not load the list.');
      if (visibleStateRef.current.scope !== requestScope || !visibleStateRef.current.watchlist) {
        setHydratedItems([]);
        setWatchlist(null);
        setStateScope(requestScope);
      }
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [currentUser, firebaseIdToken, refreshPersonalWatchlist, resourceScope, watchlistId]);

  const refreshWatchlist = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadWatchlist();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadWatchlist]);

  useEffect(() => {
    const cached = getCachedPersonalWatchlist(watchlistId);

    if (cached) {
      setHydratedItems(cached.hydratedItems);
      setWatchlist(cached.watchlist);
      setStateScope(resourceScope);
      setIsLoading(false);
      void loadWatchlist();
      return;
    }

    setHydratedItems([]);
    setWatchlist(null);
    setStateScope(resourceScope);
    void loadWatchlist();
  }, [loadWatchlist, resourceScope, watchlistId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: visibleWatchlist ? () => (
        <WatchlistCoverButton key={resourceScope} kind="personal" watchlistId={watchlistId}
          items={visibleWatchlist.items} coverItemIds={visibleWatchlist.coverItemIds}
          onSaved={(coverItemIds) => {
            setWatchlist((current) => current ? { ...current, coverItemIds } : current);
            void loadWatchlist();
          }} />
      ) : undefined,
    });
  }, [navigation, visibleWatchlist, resourceScope, watchlistId, loadWatchlist]);

  function openItem(item: WatchlistDisplayItem) {
    const title = item.title ?? (item.contentType === 'movie' ? 'Film' : 'Series');

    if (item.contentType === 'movie') {
      navigation.navigate('FilmDetail', { title, tmdbId: item.tmdbId });
      return;
    }

    navigation.navigate('SeriesDetail', { title, tmdbId: item.tmdbId });
  }

  function openSectionEditor(nextEditor: SectionEditor) {
    setSectionError(null);
    setSectionName(nextEditor.mode === 'rename' ? nextEditor.section.name : '');
    setEditor(nextEditor);
  }

  async function saveSection() {
    if (!editor || !sectionName.trim()) return;
    setSavingSection(true);
    setSectionError(null);
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to update this watchlist.');
      if (editor.mode === 'create') {
        const section = await createWatchlistSection(token, watchlistId, sectionName.trim());
        setWatchlist((current) => current ? { ...current, sections: [...(current.sections ?? []), section] } : current);
      } else {
        const section = await updateWatchlistSection(token, watchlistId, editor.section.id, sectionName.trim());
        setWatchlist((current) => current ? {
          ...current,
          sections: (current.sections ?? []).map((candidate) => candidate.id === section.id ? section : candidate),
        } : current);
      }
      hapticSuccess();
      setEditor(null);
      void loadWatchlist();
    } catch (cause) {
      hapticError();
      setSectionError(cause instanceof Error ? cause.message : 'Could not save this section.');
    } finally {
      setSavingSection(false);
    }
  }

  function showSectionActions(section: PersonalWatchlistSection) {
    Alert.alert(section.name, undefined, [
      { text: 'Rename', onPress: () => openSectionEditor({ mode: 'rename', section }) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteSection(section) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function confirmDeleteSection(section: PersonalWatchlistSection) {
    Alert.alert(
      `Delete “${section.name}”?`,
      'Its titles will return to Unsectioned.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteSection(section) },
      ],
    );
  }

  async function deleteSection(section: PersonalWatchlistSection) {
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to update this watchlist.');
      await deleteWatchlistSection(token, watchlistId, section.id);
      setHydratedItems((current) => current.map((item) => item.sectionId === section.id
        ? { ...item, sectionId: null }
        : item));
      setWatchlist((current) => current ? {
        ...current,
        items: current.items.map((item) => item.sectionId === section.id ? { ...item, sectionId: null } : item),
        sections: (current.sections ?? []).filter((candidate) => candidate.id !== section.id),
      } : current);
      hapticSuccess();
      void loadWatchlist();
    } catch (cause) {
      hapticError();
      Alert.alert('Could not delete section', cause instanceof Error ? cause.message : 'Try again.');
    }
  }

  const measureMoveTargets = useCallback(() => {
    requestAnimationFrame(() => {
      overlayRef.current?.measureInWindow((x, y) => {
        overlayOriginRef.current = { x, y };
      });
      targetViewsRef.current.forEach((view, groupId) => {
        view.measureInWindow((x, y, width, height) => {
          targetRectsRef.current.set(groupId, { height, width, x, y });
        });
      });
    });
  }, []);

  function findMoveTarget(point: ScreenPoint) {
    for (const [groupId, rect] of targetRectsRef.current) {
      if (
        point.x >= rect.x && point.x <= rect.x + rect.width
        && point.y >= rect.y && point.y <= rect.y + rect.height
      ) return groupId;
    }
    return null;
  }

  function beginMove(item: WatchlistDisplayItem, event: GestureResponderEvent) {
    const point = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    targetRectsRef.current.clear();
    setHoveredGroupId(null);
    setMoving({ item, point });
    hapticSelection();
    requestAnimationFrame(measureMoveTargets);
  }

  function updateMove(item: WatchlistDisplayItem, event: GestureResponderEvent) {
    if (moving?.item.id !== item.id) return;
    const point = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    setMoving({ item, point });
    setHoveredGroupId(findMoveTarget(point));
  }

  function endMove(item: WatchlistDisplayItem, event: GestureResponderEvent) {
    if (moving?.item.id !== item.id) return;
    const point = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    const destinationGroupId = findMoveTarget(point);
    setMoving(null);
    setHoveredGroupId(null);
    targetRectsRef.current.clear();
    if (!destinationGroupId) return;
    const sectionId = resolveDestinationSectionId(destinationGroupId);
    if ((item.sectionId ?? null) === sectionId) return;
    void moveItem(item, sectionId);
  }

  async function moveItem(item: WatchlistDisplayItem, sectionId: string | null) {
    const previousSectionId = item.sectionId ?? null;
    setHydratedItems((current) => current.map((candidate) => candidate.id === item.id
      ? { ...candidate, sectionId }
      : candidate));
    setWatchlist((current) => current ? {
      ...current,
      items: current.items.map((candidate) => candidate.id === item.id ? { ...candidate, sectionId } : candidate),
    } : current);
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to update this watchlist.');
      await moveWatchlistItemToSection(token, watchlistId, item.id, sectionId);
      hapticSuccess();
      void loadWatchlist();
    } catch (cause) {
      setHydratedItems((current) => current.map((candidate) => candidate.id === item.id
        ? { ...candidate, sectionId: previousSectionId }
        : candidate));
      setWatchlist((current) => current ? {
        ...current,
        items: current.items.map((candidate) => candidate.id === item.id
          ? { ...candidate, sectionId: previousSectionId }
          : candidate),
      } : current);
      hapticError();
      Alert.alert('Could not move title', cause instanceof Error ? cause.message : 'Try again.');
    }
  }

  if (!firebaseIdToken) {
    return (
      <WatchlistPage>
        <SignInRequiredCard
          body="You need to be signed in to use private lists. Sign in here to open this watchlist."
          title="Sign in to view this list"
        />
      </WatchlistPage>
    );
  }

  const canMoveItems = visibleSections.length > 0;
  return (
    <>
      <WatchlistPage
        isRefreshing={isRefreshing}
        onRefresh={refreshWatchlist}
        scrollEnabled={!moving}
        overlay={moving ? (
          <WatchlistMoveOverlay
            groups={groups}
            hoveredGroupId={hoveredGroupId}
            moving={moving}
            onLayout={measureMoveTargets}
            overlayOrigin={overlayOriginRef.current}
            overlayRef={overlayRef}
            targetViews={targetViewsRef.current}
          />
        ) : null}
      >
        {isLoading && !visibleWatchlist ? (
          <LoadingState label="Loading list" />
        ) : error && !visibleWatchlist ? (
          <EmptyState body={error} title="List failed">
            <Button label="Retry" onPress={() => loadWatchlist()} />
          </EmptyState>
        ) : visibleWatchlist ? (
          <WatchlistSection>
            <SectionHeader title="Titles" subtitle={`${visibleItems.length} saved`} />
            <View style={styles.topActions}>
              <Button compact label="Add titles" variant="secondary" onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })} />
              <Button
                compact
                disabled={visibleSections.length >= MAX_PERSONAL_WATCHLIST_SECTIONS}
                icon={<Plus color={colors.textOnAccent} size={18} />}
                label="Section"
                onPress={() => openSectionEditor({ mode: 'create' })}
              />
            </View>
            {visibleItems.length === 0 && visibleSections.length === 0 ? (
              <Text style={styles.emptyCopy}>
                Add films or series from detail pages, or create a section to start shaping this list.
              </Text>
            ) : groups.map((group) => {
              const collapsed = collapsedGroups.has(group.id);
              const expanded = expandedGroups.has(group.id);
              const shownItems = expanded ? group.items : group.items.slice(0, SECTION_PREVIEW_ITEM_COUNT);
              return (
                <View key={group.id} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: !collapsed }}
                      onPress={() => setCollapsedGroups((current) => toggleSetValue(current, group.id))}
                      style={({ pressed }) => [styles.groupTitleButton, pressed ? styles.pressed : null]}
                    >
                      {collapsed
                        ? <ChevronRight color={colors.textMuted} size={18} />
                        : <ChevronDown color={colors.textMuted} size={18} />}
                      <Text style={styles.groupTitle}>{group.name}</Text>
                      <Text style={styles.groupCount}>{group.items.length}</Text>
                    </Pressable>
                    {group.section ? (
                      <Pressable
                        accessibilityLabel={`Manage ${group.name}`}
                        accessibilityRole="button"
                        hitSlop={4}
                        onPress={() => showSectionActions(group.section!)}
                        style={({ pressed }) => [styles.moreButton, pressed ? styles.pressed : null]}
                      >
                        <Ellipsis color={colors.textMuted} size={20} />
                      </Pressable>
                    ) : null}
                  </View>
                  {!collapsed ? (
                    group.items.length === 0 ? (
                      <Text style={styles.emptySection}>Hold a title, then drop it here.</Text>
                    ) : (
                      <>
                        <WatchlistPosterGrid
                          items={shownItems}
                          movingItemId={moving?.item.id}
                          onMove={canMoveItems ? updateMove : undefined}
                          onMoveEnd={canMoveItems ? endMove : undefined}
                          onMoveStart={canMoveItems ? beginMove : undefined}
                          onOpen={openItem}
                        />
                        {group.items.length > SECTION_PREVIEW_ITEM_COUNT ? (
                          <Button
                            compact
                            label={expanded ? 'Show less' : `Show all ${group.items.length}`}
                            variant="ghost"
                            onPress={() => setExpandedGroups((current) => toggleSetValue(current, group.id))}
                          />
                        ) : null}
                      </>
                    )
                  ) : null}
                </View>
              );
            })}
          </WatchlistSection>
        ) : null}
      </WatchlistPage>
      <BottomActionSheet
        visible={Boolean(editor)}
        title={editor?.mode === 'rename' ? 'Rename section' : 'New section'}
        onClose={() => { if (!savingSection) setEditor(null); }}
        footer={<Button
          disabled={!sectionName.trim()}
          fullWidth
          label={editor?.mode === 'rename' ? 'Save name' : 'Create section'}
          loading={savingSection}
          onPress={() => void saveSection()}
        />}
      >
        <BottomActionSheetScrollView contentContainerStyle={styles.sheetContent}>
          <TextInput
            autoFocus
            error={sectionError ?? undefined}
            label="Name"
            maxLength={40}
            onChangeText={setSectionName}
            onSubmitEditing={() => void saveSection()}
            placeholder="Horror, Rewatch…"
            value={sectionName}
          />
        </BottomActionSheetScrollView>
      </BottomActionSheet>
    </>
  );
}

function WatchlistMoveOverlay({
  groups,
  hoveredGroupId,
  moving,
  onLayout,
  overlayOrigin,
  overlayRef,
  targetViews,
}: {
  groups: PersonalWatchlistItemGroup[];
  hoveredGroupId: string | null;
  moving: { item: WatchlistDisplayItem; point: ScreenPoint };
  onLayout: () => void;
  overlayOrigin: ScreenPoint;
  overlayRef: React.RefObject<View | null>;
  targetViews: Map<string, View>;
}) {
  const { width } = useWindowDimensions();
  const targetWidth = Math.floor((width - spacing.xl * 2 - spacing.sm) / 2);
  const ghostWidth = 68;

  return (
    <View
      pointerEvents="none"
      ref={overlayRef}
      onLayout={onLayout}
      style={styles.moveOverlay}
    >
      <Text accessibilityRole="header" style={styles.moveTitle}>Move “{moving.item.title ?? 'title'}”</Text>
      <Text style={styles.moveHint}>Drop it into a section</Text>
      <View style={styles.moveTargets}>
        {groups.map((group) => (
          <View
            key={group.id}
            ref={(view) => {
              if (view) targetViews.set(group.id, view);
              else targetViews.delete(group.id);
            }}
            onLayout={onLayout}
            style={[
              styles.moveTarget,
              { width: targetWidth },
              hoveredGroupId === group.id ? styles.moveTargetHovered : null,
            ]}
          >
            <Text numberOfLines={1} style={styles.moveTargetName}>{group.name}</Text>
            <Text style={styles.moveTargetCount}>{group.items.length} titles</Text>
          </View>
        ))}
      </View>
      <View style={[
        styles.draggedPoster,
        {
          left: moving.point.x - overlayOrigin.x - ghostWidth / 2,
          top: moving.point.y - overlayOrigin.y - 82,
          width: ghostWidth,
        },
      ]}>
        <MediaPoster
          accessibilityLabel={`${moving.item.title ?? 'Title'} poster being moved`}
          posterUrl={moving.item.posterUrl}
          style={styles.draggedPosterImage}
        />
      </View>
    </View>
  );
}

function toggleSetValue(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const styles = StyleSheet.create({
  draggedPoster: {
    position: 'absolute',
    shadowColor: '#02040A',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
  draggedPosterImage: {
    aspectRatio: 2 / 3,
    borderColor: colors.accentText,
    borderRadius: radii.md,
    borderWidth: 2,
    width: '100%',
  },
  emptyCopy: {
    ...typography.body,
    color: colors.textMuted,
  },
  emptySection: {
    ...typography.meta,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    color: colors.textSubtle,
    padding: spacing.lg,
    textAlign: 'center',
  },
  group: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  groupCount: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  groupTitleButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: touchTargets.min,
  },
  moreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.min,
    minWidth: touchTargets.min,
  },
  moveHint: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  moveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    zIndex: 20,
  },
  moveTarget: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  moveTargetCount: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  moveTargetHovered: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  moveTargetName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  moveTargets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  moveTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  sheetContent: {
    paddingBottom: spacing.md,
  },
  topActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
