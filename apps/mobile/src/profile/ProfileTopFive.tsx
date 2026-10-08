import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Crown, Heart, Sparkle, Star, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { ProfileBackdropSelection } from '../api/profile';
import { CatalogueTitlePicker } from '../catalogue/CatalogueTitlePicker';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, spacing, typography } from '../design/tokens';
import type { LibraryMediaItem } from '../library/useLibraryData';
import type { WatchlistDisplayItem } from '../watchlists/WatchlistDetailLayout';
import { moveFavorite } from './profileMediaModel';
import { buildTopFiveItems } from './profileTopFiveModel';
import { getProfileMediaDisplayTitle, useHydratedProfileMediaItems } from './useHydratedProfileMediaItems';

const EMPTY_SELECTION: ProfileBackdropSelection[] = [];
const EMPTY_CANDIDATES: LibraryMediaItem[] = [];
const PODIUM_ORDER = [3, 1, 0, 2, 4];
const WINNER_COLOR = '#F5C65A';
const RANK_COLORS = [WINNER_COLOR, '#C8CFDB', '#D78B72', '#A58A9A', '#A58A9A'];

export function ProfileTopFive({ selection = EMPTY_SELECTION, candidates = EMPTY_CANDIDATES, onOpen, onSave }: {
  selection?: ProfileBackdropSelection[];
  candidates?: LibraryMediaItem[];
  onOpen: (item: LibraryMediaItem) => void;
  onSave?: (items: ProfileBackdropSelection[]) => Promise<ProfileBackdropSelection[]>;
}) {
  const [saved, setSaved] = useState<ProfileBackdropSelection[] | null>(null);
  const sources = useMemo(() => buildTopFiveItems(saved ?? selection), [saved, selection]);
  const hydrated = useHydratedProfileMediaItems(sources);
  const items = sources.map((item) => hydrated.find((candidate) => candidate.key === item.key) ?? item);
  const [draft, setDraft] = useState<WatchlistDisplayItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    if (saved && JSON.stringify(saved) === JSON.stringify(selection)) setSaved(null);
  }, [saved, selection]);

  function edit() {
    setError(null);
    setDraft(items.map((item) => ({ ...item, id: item.key })));
  }

  async function save() {
    if (!onSave || draft?.length !== 5 || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const updated = await onSave(draft.map(({ contentType, tmdbId }) => ({ contentType, tmdbId })));
      setSaved(updated);
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your Top 5. Try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const complete = sources.length === 5;
  if (!onSave && !complete) return null;

  return <View style={styles.section}>
    {complete ? <View style={styles.podium}><View style={styles.header}>
      <View style={styles.podiumHeading}><Star size={26} color={colors.accent} fill={colors.accent} />
        <Text accessibilityRole="header" style={styles.podiumHeadingText}>Top 5 Favorites</Text>
      </View>
      {onSave ? <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={edit} hitSlop={10}
        style={({ pressed }) => [styles.edit, pressed && styles.invitationPressed]}>
        <Text style={styles.editLabel}>Edit</Text><ChevronRight size={18} color={colors.accent} />
      </Pressable> : null}
    </View>
    <View style={styles.posters}>
      {PODIUM_ORDER.map((index) => {
        const item = items[index];
        const rankColor = RANK_COLORS[index];
        const podiumHeight = index === 0 ? 72 : index < 3 ? 60 : 48;
        return <View key={item.key} style={styles.slot}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Number ${index + 1}: ${getProfileMediaDisplayTitle(item)}`}
            onPress={() => onOpen(item)} style={({ pressed }) => [styles.posterButton,
              index === 0 ? styles.winnerPoster : index > 2 ? styles.outerPoster : styles.runnerUpPoster,
              { paddingBottom: podiumHeight },
              pressed && styles.invitationPressed]}>
            <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
              style={[styles.podiumBase, { height: podiumHeight + 16 }]}>
              <Svg width="100%" height="100%" viewBox={`0 0 100 ${podiumHeight + 16}`} preserveAspectRatio="none">
                <Defs>
                  <RadialGradient id={`podiumGlow${index}`} cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0" stopColor={colors.accent} stopOpacity={0.12} />
                    <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
                  </RadialGradient>
                  <LinearGradient id={`podiumRing${index}`} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={colors.accent} stopOpacity={0} />
                    <Stop offset="0.25" stopColor={index === 0 ? WINNER_COLOR : colors.accentText} stopOpacity={0.55} />
                    <Stop offset="0.75" stopColor={index === 0 ? WINNER_COLOR : colors.accentText} stopOpacity={0.55} />
                    <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
                  </LinearGradient>
                  <LinearGradient id={`podiumSurface${index}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.panelElevated} stopOpacity={0.6} />
                    <Stop offset="1" stopColor={colors.panel} stopOpacity={0.35} />
                  </LinearGradient>
                  <LinearGradient id={`podiumFront${index}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={index === 0 ? WINNER_COLOR : colors.accent} stopOpacity={0.35} />
                    <Stop offset="0.3" stopColor={index === 0 ? '#49371D' : '#49202D'} stopOpacity={0.4} />
                    <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Ellipse cx="50" cy={podiumHeight + 10} rx="50" ry="6" fill={`url(#podiumGlow${index})`} />
                <Path d={`M 8 16 L 8 ${podiumHeight + 8} A 42 6 0 0 0 92 ${podiumHeight + 8} L 92 16 Z`}
                  fill={`url(#podiumFront${index})`} />
                <Ellipse cx="50" cy="16" rx="42" ry="6" fill={`url(#podiumSurface${index})`}
                  stroke={`url(#podiumRing${index})`} strokeWidth={index === 0 ? 1.2 : 0.8} />
              </Svg>
            </View>
            <View style={[styles.posterFrame, index === 0 && styles.winnerFrame]}>
              <MediaPoster posterUrl={item.posterUrl} style={[styles.poster, (index === 1 || index === 2) && styles.runnerUpPosterImage, index > 2 && styles.outerPosterImage,
                index === 0 && styles.winnerPosterImage]} />
            </View>
            <View pointerEvents="none" style={[styles.podiumLabel, { height: podiumHeight - 16 }]}>
              <Text numberOfLines={2} style={styles.podiumTitle}>{getProfileMediaDisplayTitle(item)}</Text>
            </View>
            <View pointerEvents="none" style={[styles.podiumRank, { borderColor: rankColor }, index === 0 && styles.winnerRank]}>
              {index === 0 ? <Crown size={32} color={WINNER_COLOR} fill="#000000" strokeWidth={1.5} style={styles.crown} /> : null}
              <Text style={[styles.podiumRankText, { color: rankColor }, index === 0 && styles.winnerRankText]}>{index + 1}</Text>
            </View>
          </Pressable>
        </View>;
      })}
    </View></View> : <Pressable accessibilityRole="button" accessibilityLabel="Create your Top 5" onPress={edit}
      style={({ pressed }) => [styles.invitation, pressed && styles.invitationPressed]}>
      <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFillObject}>
        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 360 110">
          <Defs>
            <LinearGradient id="topFiveInvitationPanel" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.panelElevated} />
              <Stop offset="1" stopColor={colors.panel} />
            </LinearGradient>
            <RadialGradient id="topFiveInvitationGlow" cx="0.17" cy="0.6" rx="0.3" ry="0.9">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.18} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="360" height="110" fill="url(#topFiveInvitationPanel)" />
          <Rect width="360" height="110" fill="url(#topFiveInvitationGlow)" />
        </Svg>
      </View>
      <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.invitationArtwork}>
        <View style={styles.invitationBackCard} />
        <View style={styles.invitationFrontCard}><Heart size={23} strokeWidth={1.6} color={colors.accentText} /></View>
        <Sparkle size={11} strokeWidth={1} fill={colors.accentText} color={colors.accentText} style={styles.invitationSparkleTop} />
        <Sparkle size={10} strokeWidth={1} fill={colors.accentText} color={colors.accentText} style={styles.invitationSparkleBottom} />
      </View>
      <View style={styles.invitationCopy}>
        <Text style={styles.invitationTitle}>Your favorites, your story</Text>
        <Text style={styles.invitationSubtitle}>Add the movies and shows that define you.</Text>
        <View style={styles.invitationButton}>
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1">
              <Defs><LinearGradient id="topFiveInvitationButton" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.accent} />
                <Stop offset="1" stopColor={colors.accentPressed} />
              </LinearGradient></Defs>
              <Rect width="1" height="1" fill="url(#topFiveInvitationButton)" />
            </Svg>
          </View>
          <Text style={styles.invitationButtonLabel}>Create your Top 5</Text>
          <ChevronRight color={colors.textOnAccent} size={14} strokeWidth={2} />
        </View>
      </View>
    </Pressable>}
    <BottomActionSheet title={<><Text style={styles.editorHeading}>Choose your <Text style={styles.editorAccent}>Top 5</Text></Text>
      <Text style={styles.editorSubtitle}>{'\n'}Pick the movies and shows that define your taste.</Text></>}
      sheetStyle={styles.editorSheet} visible={draft !== null} onClose={() => { if (!savingRef.current) setDraft(null); }}
      footer={<View style={styles.saveGlow}><Button label="Save Top 5" disabled={draft?.length !== 5} loading={saving} onPress={() => void save()} /></View>}>
      {draft ? <BottomActionSheetScrollView contentContainerStyle={styles.editor}>
        <CatalogueTitlePicker label="Search Top 5 titles" items={candidates.slice(0, 25).map((item) => ({ ...item, id: item.key }))}
          selected={draft} onChange={setDraft} limit={5} disabled={saving} emptyLabel="" appearance="top-five" />
        {draft.length > 0 ? <Text style={styles.heading}>Your ranking</Text> : null}
        {draft.map((item, index) => <View key={item.id} style={styles.draftRow}>
          <Text style={styles.rank}>{index + 1}</Text>
          <MediaPoster posterUrl={item.posterUrl} style={styles.miniPoster} />
          <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.title} up`} accessibilityState={{ disabled: saving || index === 0 }}
            disabled={saving || index === 0} onPress={() => setDraft(moveFavorite(draft, index, index - 1))}
            style={[styles.control, (saving || index === 0) && styles.disabled]}><ArrowUp size={18} color={colors.text} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.title} down`} accessibilityState={{ disabled: saving || index === draft.length - 1 }}
            disabled={saving || index === draft.length - 1} onPress={() => setDraft(moveFavorite(draft, index, index + 1))}
            style={[styles.control, (saving || index === draft.length - 1) && styles.disabled]}><ArrowDown size={18} color={colors.text} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from Top 5`} disabled={saving}
            onPress={() => setDraft(draft.filter((_, position) => position !== index))} style={styles.control}><X size={18} color={colors.textMuted} /></Pressable>
        </View>)}
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      </BottomActionSheetScrollView> : null}
    </BottomActionSheet>
  </View>;
}

const styles = StyleSheet.create({
  invitation: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md - 2,
    minHeight: 104, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.panel, overflow: 'hidden' },
  invitationPressed: { opacity: 0.84 },
  invitationArtwork: { width: 68, height: 72 },
  invitationBackCard: { position: 'absolute', left: 12, top: 21, width: 33, height: 44,
    borderRadius: radii.xs, borderWidth: 1, borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft, transform: [{ rotate: '-10deg' }] },
  invitationFrontCard: { position: 'absolute', left: 24, top: 15, width: 34, height: 46,
    borderRadius: radii.xs, borderWidth: 1, borderColor: colors.accent,
    backgroundColor: colors.panel, transform: [{ rotate: '10deg' }], alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 9, shadowOffset: { width: 0, height: 2 } },
  invitationSparkleTop: { position: 'absolute', right: 0, top: 2 },
  invitationSparkleBottom: { position: 'absolute', left: 2, bottom: 0 },
  invitationCopy: { flex: 1, minWidth: 0 },
  invitationTitle: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  invitationSubtitle: { color: colors.textSubtle, fontSize: 11, lineHeight: 16, marginTop: 2 },
  invitationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    minHeight: 30, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, marginTop: spacing.xs,
    backgroundColor: colors.accent, borderRadius: radii.xl, overflow: 'hidden' },
  invitationButtonLabel: { ...typography.meta, color: colors.textOnAccent },
  section: { gap: spacing.sm },
  podium: { marginHorizontal: -spacing.xs, paddingTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  edit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, minHeight: 32, minWidth: 44 },
  editLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.accent },
  heading: { ...typography.eyebrow, color: colors.textMuted },
  podiumHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  podiumHeadingText: { fontSize: 19, lineHeight: 26, color: colors.text, fontWeight: '700' },
  posters: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingTop: spacing.xxl },
  slot: { flex: 1, minWidth: 0, alignItems: 'center' },
  posterButton: { alignSelf: 'center' },
  winnerPoster: { width: '100%' },
  runnerUpPoster: { width: '94%' },
  outerPoster: { width: '90%' },
  posterFrame: { borderRadius: 4 },
  winnerFrame: { shadowColor: colors.accent, shadowOpacity: 0.85, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: 4, borderWidth: 1, borderColor: colors.borderStrong },
  runnerUpPosterImage: { aspectRatio: 0.72 },
  outerPosterImage: { aspectRatio: 0.75 },
  winnerPosterImage: { borderColor: colors.accentText },
  podiumBase: { position: 'absolute', left: '-12%', right: '-12%', bottom: 0 },
  podiumLabel: { position: 'absolute', left: 0, right: 0, bottom: 6, justifyContent: 'center', paddingHorizontal: 2 },
  podiumTitle: { fontSize: 12, lineHeight: 16, color: colors.text, textAlign: 'center', alignSelf: 'stretch' },
  podiumRank: { position: 'absolute', left: -3, top: -8, width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  podiumRankText: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  winnerRank: { top: -18, left: '50%', marginLeft: -16, width: 32, height: 32, borderRadius: 0, borderWidth: 0,
    backgroundColor: 'transparent', shadowColor: WINNER_COLOR, shadowOpacity: 0.55, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  winnerRankText: { position: 'absolute', top: 7, fontSize: 13, lineHeight: 18, color: WINNER_COLOR },
  crown: { position: 'absolute', top: 0, left: 0 },
  rank: { ...typography.meta, color: colors.textSubtle, textAlign: 'center' },
  editor: { gap: spacing.md, paddingBottom: spacing.xl },
  editorSheet: { top: '12%', backgroundColor: colors.background, borderColor: colors.accentBorder,
    shadowColor: colors.accent, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -3 } },
  editorHeading: { fontSize: 22, lineHeight: 29, fontWeight: '700', color: colors.text },
  editorAccent: { color: colors.accent },
  editorSubtitle: { fontSize: 12, lineHeight: 20, fontWeight: '400', color: colors.textSubtle },
  saveGlow: { shadowColor: colors.accent, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  miniPoster: { width: 32, height: 48, borderRadius: radii.sm },
  title: { ...typography.meta, color: colors.text, flex: 1 },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  error: { ...typography.meta, color: colors.danger },
});
