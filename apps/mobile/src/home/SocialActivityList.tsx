import { StyleSheet, View } from 'react-native';
import { SocialReviewPost } from '../components/SocialReviewPost';
import { spacing } from '../design/tokens';
import type { FeedLikeState } from '../feed/feedLikeModel';
import type { HomeFeedItem } from './homeData';

type SocialActivityListProps = {
  items: HomeFeedItem[];
  onOpenContent: (item: HomeFeedItem) => void;
  onSetLiked: (item: HomeFeedItem, liked: boolean) => Promise<FeedLikeState>;
};

export function SocialActivityList({ items, onOpenContent, onSetLiked }: SocialActivityListProps) {
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
          likeCount={item.likeCount}
          likedByViewer={item.likedByViewer}
          onOpenContent={() => onOpenContent(item)}
          onSetLiked={(liked) => onSetLiked(item, liked)}
          rating={item.rating}
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
