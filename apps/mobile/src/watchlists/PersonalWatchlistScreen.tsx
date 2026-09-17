import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronDown, ChevronRight, Ellipsis, Plus } from 'lucide-react-native';
import {
  Alert,
  Animated,
  ActionSheetIOS,
  GestureResponderEvent,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  resolveCarriedPosterTilt,
  resolveDestinationSectionId,
  resolveWatchlistAutoScrollDelta,
  SECTION_PREVIEW_ITEM_COUNT,
} from './watchlistSections';

type PersonalWatchlistScreenProps = NativeStackScreenProps<RootStackParamList, 'PersonalWatchlist'>;
type SectionEditor = { mode: 'create' } | { mode: 'rename'; section: PersonalWatchlistSection };
type ScreenPoint = { x: number; y: number };
type ScreenRect = ScreenPoint & { height: number; width: number };
type MovingTitle = {
  gripX: number;
  gripY: number;
  item: WatchlistDisplayItem;
  point: ScreenPoint;
  width: number;
};

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
  const [moving, setMoving] = useState<MovingTitle | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [stateScope, setStateScope] = useState(resourceScope);
  const [watchlist, setWatchlist] = useState<PersonalWatchlist | null>(() => initialCached?.watchlist ?? null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const dragScale = useRef(new Animated.Value(1)).current;
  const dragTilt = useRef(new Animated.Value(0)).current;
  const dragTiltResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragTiltValueRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const measureFrameRef = useRef<number | null>(null);
  const movingRef = useRef<MovingTitle | null>(null);
  const overlayOriginRef = useRef<ScreenPoint>({ x: 0, y: 0 });
  const overlayRef = useRef<View>(null);
  const requestRef = useRef({ scope: resourceScope, version: 0 });
  const scrollMetricsRef = useRef({ contentHeight: 0, offsetY: 0, viewportHeight: 0 });
  const scrollRef = useRef<ScrollView>(null);
  const scrollViewportRef = useRef({ bottom: 0, top: 0 });
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

  useEffect(() => () => {
    if (autoScrollFrameRef.current !== null) cancelAnimationFrame(autoScrollFrameRef.current);
    if (dragTiltResetRef.current !== null) clearTimeout(dragTiltResetRef.current);
    if (measureFrameRef.current !== null) cancelAnimationFrame(measureFrameRef.current);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitle}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitleText}>
            {route.params.title}
          </Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>
            {visibleItems.length} {visibleItems.length === 1 ? 'title' : 'titles'}
          </Text>
        </View>
      ),
      headerRight: visibleWatchlist ? () => (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityHint="Choose whether to add a title or create a section"
            accessibilityLabel="Add to watchlist"
            accessibilityRole="button"
            onPress={showAddActions}
            style={({ pressed }) => [styles.headerButton, pressed ? styles.pressed : null]}
          >
            <Plus color={colors.text} size={20} strokeWidth={2} />
          </Pressable>
          <WatchlistCoverButton key={resourceScope} kind="personal" watchlistId={watchlistId}
            items={visibleWatchlist.items} coverItemIds={visibleWatchlist.coverItemIds}
            onSaved={(coverItemIds) => {
              setWatchlist((current) => current ? { ...current, coverItemIds } : current);
              void loadWatchlist();
            }} />
        </View>
      ) : undefined,
    });
  }, [navigation, visibleWatchlist, resourceScope, route.params.title, watchlistId, loadWatchlist, visibleItems.length, visibleSections.length]);

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

  function showAddActions() {
    const addTitle = () => navigation.navigate('MainTabs', { screen: 'Explore' });
    const addSection = () => openSectionEditor({ mode: 'create' });
    const sectionLimitReached = visibleSections.length >= MAX_PERSONAL_WATCHLIST_SECTIONS;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({
        cancelButtonIndex: 2,
        disabledButtonIndices: sectionLimitReached ? [1] : undefined,
        message: 'What would you like to add?',
        options: ['Add a title', 'Create a section', 'Cancel'],
        title: 'Add to watchlist',
      }, (buttonIndex) => {
        if (buttonIndex === 0) addTitle();
        if (buttonIndex === 1 && !sectionLimitReached) addSection();
      });
      return;
    }

    Alert.alert('Add to watchlist', 'What would you like to add?', [
      { text: 'Add a title', onPress: addTitle },
      ...(!sectionLimitReached ? [{ text: 'Create a section', onPress: addSection }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
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
    if (measureFrameRef.current !== null) cancelAnimationFrame(measureFrameRef.current);
    measureFrameRef.current = requestAnimationFrame(() => {
      measureFrameRef.current = null;
      overlayRef.current?.measureInWindow((x, y) => {
        overlayOriginRef.current = { x, y };
      });
      scrollRef.current?.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
        scrollViewportRef.current = { bottom: y + height, top: y };
      });
      targetViewsRef.current.forEach((view, groupId) => {
        view.measureInWindow((x, y, width, height) => {
          targetRectsRef.current.set(groupId, { height, width, x, y });
          const activeMove = movingRef.current;
          if (activeMove) setHoveredGroupId(findMoveTarget(activeMove.point));
        });
      });
    });
  }, []);

  function stopAutoScroll() {
    if (autoScrollFrameRef.current === null) return;
    cancelAnimationFrame(autoScrollFrameRef.current);
    autoScrollFrameRef.current = null;
  }

  function startAutoScroll() {
    if (autoScrollFrameRef.current !== null) return;

    const tick = () => {
      autoScrollFrameRef.current = null;
      const activeMove = movingRef.current;
      if (!activeMove) return;

      const { bottom, top } = scrollViewportRef.current;
      if (bottom <= top) return;
      const delta = resolveWatchlistAutoScrollDelta(activeMove.point.y, top, bottom);
      if (delta === 0) return;

      const metrics = scrollMetricsRef.current;
      const maxOffset = Math.max(0, metrics.contentHeight - metrics.viewportHeight);
      const nextOffset = Math.max(0, Math.min(maxOffset, metrics.offsetY + delta));
      if (nextOffset === metrics.offsetY) return;

      metrics.offsetY = nextOffset;
      scrollRef.current?.scrollTo({ animated: false, y: nextOffset });
      autoScrollFrameRef.current = requestAnimationFrame(tick);
    };

    autoScrollFrameRef.current = requestAnimationFrame(tick);
  }

  function handleContentSizeChange(_width: number, height: number) {
    scrollMetricsRef.current.contentHeight = height;
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    scrollMetricsRef.current = {
      contentHeight: contentSize.height,
      offsetY: contentOffset.y,
      viewportHeight: layoutMeasurement.height,
    };
    if (movingRef.current) measureMoveTargets();
  }

  function handleScrollLayout(event: LayoutChangeEvent) {
    scrollMetricsRef.current.viewportHeight = event.nativeEvent.layout.height;
    measureMoveTargets();
  }

  function findMoveTarget(point: ScreenPoint) {
    for (const [groupId, rect] of targetRectsRef.current) {
      if (
        point.x >= rect.x && point.x <= rect.x + rect.width
        && point.y >= rect.y && point.y <= rect.y + rect.height
      ) return groupId;
    }
    return null;
  }

  function beginMove(
    item: WatchlistDisplayItem,
    event: GestureResponderEvent,
    geometry: { gripX: number; gripY: number; width: number },
  ) {
    const point = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    targetRectsRef.current.clear();
    setHoveredGroupId(null);
    const nextMoving = { item, point, ...geometry };
    movingRef.current = nextMoving;
    setMoving(nextMoving);
    dragTiltValueRef.current = 0;
    lastMoveTimeRef.current = Date.now();
    dragTilt.setValue(0);
    dragScale.setValue(0.98);
    Animated.spring(dragScale, {
      damping: 14,
      mass: 0.5,
      stiffness: 240,
      toValue: 1,
      useNativeDriver: false,
    }).start();
    hapticSelection();
    requestAnimationFrame(measureMoveTargets);
  }

  function updateMove(item: WatchlistDisplayItem, event: GestureResponderEvent) {
    if (movingRef.current?.item.id !== item.id) return;
    const point = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    const activeMove = movingRef.current;
    const now = Date.now();
    const elapsedMs = Math.max(8, Math.min(64, now - lastMoveTimeRef.current));
    const horizontalDelta = point.x - activeMove.point.x;
    const horizontalVelocity = horizontalDelta / elapsedMs * 1000;
    lastMoveTimeRef.current = now;
    const nextMoving = { ...activeMove, point };
    movingRef.current = nextMoving;
    setMoving(nextMoving);
    animateDragTilt(horizontalVelocity);
    setHoveredGroupId(findMoveTarget(point));
    startAutoScroll();
  }

  function endMove(item: WatchlistDisplayItem, event: GestureResponderEvent) {
    if (movingRef.current?.item.id !== item.id) return;
    const point = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    const destinationGroupId = findMoveTarget(point);
    resetDragAnimation();
    stopAutoScroll();
    movingRef.current = null;
    setMoving(null);
    setHoveredGroupId(null);
    targetRectsRef.current.clear();
    if (!destinationGroupId) return;
    const sectionId = resolveDestinationSectionId(destinationGroupId);
    if ((item.sectionId ?? null) === sectionId) return;
    void moveItem(item, sectionId);
  }

  function cancelMove(item: WatchlistDisplayItem) {
    if (movingRef.current?.item.id !== item.id) return;
    resetDragAnimation();
    stopAutoScroll();
    movingRef.current = null;
    setMoving(null);
    setHoveredGroupId(null);
    targetRectsRef.current.clear();
  }

  function animateDragTilt(horizontalVelocity: number) {
    const targetTilt = resolveCarriedPosterTilt(horizontalVelocity);
    const visibleTilt = dragTiltValueRef.current * 0.35 + targetTilt * 0.65;
    dragTilt.stopAnimation();
    dragTiltValueRef.current = visibleTilt;
    dragTilt.setValue(visibleTilt);

    if (dragTiltResetRef.current !== null) clearTimeout(dragTiltResetRef.current);
    dragTiltResetRef.current = setTimeout(() => {
      dragTiltResetRef.current = null;
      Animated.spring(dragTilt, {
        damping: 5,
        mass: 1.05,
        stiffness: 62,
        toValue: 0,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) dragTiltValueRef.current = 0;
      });
    }, 120);
  }

  function resetDragAnimation() {
    if (dragTiltResetRef.current !== null) {
      clearTimeout(dragTiltResetRef.current);
      dragTiltResetRef.current = null;
    }
    dragScale.stopAnimation();
    dragTilt.stopAnimation();
    dragTiltValueRef.current = 0;
    dragScale.setValue(1);
    dragTilt.setValue(0);
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
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleScrollLayout}
        onRefresh={refreshWatchlist}
        onScroll={handleScroll}
        scrollEnabled={!moving}
        scrollRef={scrollRef}
        overlay={moving ? (
          <WatchlistMoveOverlay
            dragScale={dragScale}
            dragTilt={dragTilt}
            moving={moving}
            onLayout={measureMoveTargets}
            overlayOrigin={overlayOriginRef.current}
            overlayRef={overlayRef}
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
            {visibleItems.length === 0 && visibleSections.length === 0 ? (
              <Text style={styles.emptyCopy}>
                Add films or series from detail pages, or create a section to start shaping this list.
              </Text>
            ) : groups.map((group) => {
              const collapsed = collapsedGroups.has(group.id);
              const expanded = expandedGroups.has(group.id);
              const shownItems = expanded ? group.items : group.items.slice(0, SECTION_PREVIEW_ITEM_COUNT);
              return (
                <View
                  key={group.id}
                  ref={(view) => {
                    if (view) targetViewsRef.current.set(group.id, view);
                    else targetViewsRef.current.delete(group.id);
                  }}
                  onLayout={moving ? measureMoveTargets : undefined}
                  style={[
                    styles.group,
                    hoveredGroupId === group.id ? styles.groupDropTarget : null,
                  ]}
                >
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
                          onMoveCancel={canMoveItems ? cancelMove : undefined}
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
  dragScale,
  dragTilt,
  moving,
  onLayout,
  overlayOrigin,
  overlayRef,
}: {
  dragScale: Animated.Value;
  dragTilt: Animated.Value;
  moving: MovingTitle;
  onLayout: () => void;
  overlayOrigin: ScreenPoint;
  overlayRef: React.RefObject<View | null>;
}) {
  const rotation = dragTilt.interpolate({
    inputRange: [-24, 0, 24],
    outputRange: ['-24deg', '0deg', '24deg'],
  });

  return (
    <View
      pointerEvents="none"
      ref={overlayRef}
      onLayout={onLayout}
      style={styles.moveOverlay}
    >
      <Animated.View style={[
        styles.draggedPoster,
        {
          left: moving.point.x - overlayOrigin.x - moving.gripX,
          top: moving.point.y - overlayOrigin.y - moving.gripY,
          transform: [{ rotate: rotation }, { scale: dragScale }],
          transformOrigin: [moving.gripX, moving.gripY, 0],
          width: moving.width,
        },
      ]}>
        <MediaPoster
          accessibilityLabel={`${moving.item.title ?? 'Title'} poster being moved`}
          posterUrl={moving.item.posterUrl}
          style={styles.draggedPosterImage}
        />
      </Animated.View>
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
  headerActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
  },
  headerButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: 44,
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 13,
    textAlign: 'center',
  },
  headerTitle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
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
  groupDropTarget: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
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
  moveOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  pressed: {
    opacity: 0.72,
  },
  sheetContent: {
    paddingBottom: spacing.md,
  },
});
