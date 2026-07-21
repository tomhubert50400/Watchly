import { StyleSheet, View } from 'react-native';
import { SocialReviewPost } from '../components/SocialReviewPost';
import { spacing } from '../design/tokens';
import type { HomeFeedItem } from './homeData';

type SocialActivityListProps = {
  items: HomeFeedItem[];
  onOpenContent: (item: HomeFeedItem) => void;
};

export function SocialActivityList({ items, onOpenContent }: SocialActivityListProps) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <SocialReviewPost
          authorDisplayName={item.authorDisplayName}
          body={item.body}
          contentImageUrl={item.contentImageUrl}
          contentMeta={formatContentMeta(item)}
          contentTitle={item.contentTitle}
          key={item.id}
          onOpenContent={() => onOpenContent(item)}
          updatedAt={item.updatedAt}
        />
      ))}
    </View>
  );
}

function formatContentMeta(item: HomeFeedItem) {
  if (item.target.contentType === 'movie') {
    return 'Movie review';
  }

  return `Season ${item.target.seasonNumber} · Episode ${item.target.episodeNumber}`;
}

const styles = StyleSheet.create({
  list: {
    paddingRight: spacing.xl,
  },
});
