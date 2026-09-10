import { ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Play } from 'lucide-react-native';
import {
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CatalogueCastMember,
  CatalogueRelatedItem,
  CatalogueVideo,
} from '../api/catalogue';
import { MediaPoster } from '../components/MediaPoster';
import { SectionHeader } from '../components/SectionHeader';
import { colors, radii, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { formatDetailDate } from './detailModel';

export function CatalogueVideoRail({ videos }: { videos: CatalogueVideo[] }) {
  if (videos.length === 0) {
    return null;
  }

  return (
    <CatalogueSection title="Teasers & trailers">
      <ScrollView contentContainerStyle={styles.bleedRail} horizontal showsHorizontalScrollIndicator={false}>
        {videos.map((video) => {
          const publishedDate = formatDetailDate(video.publishedAt?.slice(0, 10) ?? null);

          return (
            <Pressable
              accessibilityLabel={`Play ${video.name}${publishedDate ? `, ${publishedDate}` : ''}`}
              accessibilityRole="button"
              key={video.id}
              onPress={() => {
                void Linking.openURL(`https://www.youtube.com/watch?v=${encodeURIComponent(video.key)}`)
                  .catch(() => undefined);
              }}
              style={({ pressed }) => [styles.videoCard, pressed ? styles.pressed : null]}
            >
              <ImageBackground
                accessibilityIgnoresInvertColors
                imageStyle={styles.videoImage}
                source={{ uri: `https://i.ytimg.com/vi/${encodeURIComponent(video.key)}/hqdefault.jpg` }}
                style={styles.videoArtwork}
              >
                <View style={styles.videoScrim} />
                <View style={styles.playButton}>
                  <Play color={colors.text} fill={colors.text} size={20} strokeWidth={1.8} />
                </View>
                <View style={styles.videoCopy}>
                  <Text numberOfLines={2} style={styles.videoTitle}>{video.name}</Text>
                  <Text numberOfLines={1} style={styles.videoMeta}>{publishedDate ?? video.type}</Text>
                </View>
              </ImageBackground>
            </Pressable>
          );
        })}
      </ScrollView>
    </CatalogueSection>
  );
}

export function CatalogueCastRail({ cast }: { cast: CatalogueCastMember[] }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  if (cast.length === 0) {
    return null;
  }

  return (
    <CatalogueSection title="Cast">
      <ScrollView contentContainerStyle={styles.bleedRail} horizontal showsHorizontalScrollIndicator={false}>
        {cast.map((person) => (
          <Pressable
            accessibilityLabel={person.character ? `${person.name}, ${person.character}` : person.name}
            accessibilityRole="button"
            accessibilityHint="Opens this actor's biography and filmography."
            key={person.id}
            onPress={() => navigation.navigate('ActorDetail', { name: person.name, tmdbId: person.id })}
            style={({ pressed }) => [styles.personCard, pressed ? styles.pressed : null]}
          >
            {person.profileUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                accessible={false}
                source={{ uri: person.profileUrl }}
                style={styles.personPortrait}
              />
            ) : (
              <View style={[styles.personPortrait, styles.personPlaceholder]}>
                <Text style={styles.personInitial}>{person.name.trim().slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <Text numberOfLines={2} style={styles.personName}>{person.name}</Text>
            {person.character ? <Text numberOfLines={2} style={styles.personRole}>{person.character}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </CatalogueSection>
  );
}

export function CatalogueKeywordList({ keywords }: { keywords: string[] }) {
  if (keywords.length === 0) {
    return null;
  }

  return (
    <CatalogueSection title="Discover by keyword">
      <View style={styles.keywordList}>
        {keywords.map((keyword) => (
          <View key={keyword} style={styles.keywordPill}>
            <Text style={styles.keywordText}>{keyword}</Text>
          </View>
        ))}
      </View>
    </CatalogueSection>
  );
}

export function CatalogueRelatedRail({
  items,
  onOpen,
}: {
  items: CatalogueRelatedItem[];
  onOpen: (item: CatalogueRelatedItem) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <CatalogueSection title="More like this">
      <ScrollView contentContainerStyle={styles.bleedRail} horizontal showsHorizontalScrollIndicator={false}>
        {items.map((item) => {
          const year = item.releaseDate?.slice(0, 4) ?? null;

          return (
            <Pressable
              accessibilityLabel={`Open ${item.title}${year ? `, ${year}` : ''}`}
              accessibilityRole="button"
              key={`${item.mediaType}:${item.tmdbId}`}
              onPress={() => onOpen(item)}
              style={({ pressed }) => [styles.relatedCard, pressed ? styles.pressed : null]}
            >
              <MediaPoster
                accessibilityLabel={`${item.title} poster`}
                posterUrl={item.posterUrl}
                style={styles.relatedPoster}
              />
              <Text numberOfLines={2} style={styles.relatedTitle}>{item.title}</Text>
              {year ? <Text style={styles.relatedMeta}>{year}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </CatalogueSection>
  );
}

function CatalogueSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <SectionHeader title={title} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bleedRail: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  keywordList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  keywordPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  keywordText: {
    ...typography.meta,
    color: colors.textMuted,
    fontSize: 13,
  },
  personCard: {
    width: 96,
  },
  personInitial: {
    ...typography.title,
    color: colors.accentText,
  },
  personName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  personPlaceholder: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
  },
  personPortrait: {
    borderRadius: radii.lg,
    height: 124,
    width: 96,
  },
  personRole: {
    ...typography.meta,
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 15,
    marginTop: 2,
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(9, 12, 19, 0.62)',
    borderColor: 'rgba(255, 255, 255, 0.38)',
    borderRadius: 24,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -23,
    marginTop: -23,
    position: 'absolute',
    top: '45%',
    width: 46,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  relatedCard: {
    width: 112,
  },
  relatedMeta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  relatedPoster: {
    height: 168,
    width: 112,
  },
  relatedTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.sm,
    marginHorizontal: -spacing.xl,
    paddingTop: spacing.xxl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
  },
  videoArtwork: {
    height: '100%',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  videoCard: {
    borderRadius: radii.lg,
    height: 154,
    overflow: 'hidden',
    width: 262,
  },
  videoCopy: {
    padding: spacing.md,
  },
  videoImage: {
    borderRadius: radii.lg,
  },
  videoMeta: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: 2,
  },
  videoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 12, 19, 0.28)',
  },
  videoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 20,
  },
});
