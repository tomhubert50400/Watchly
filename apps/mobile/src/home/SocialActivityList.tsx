import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReportTarget } from '../api/reports';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SocialReviewPost } from '../components/SocialReviewPost';
import { spacing } from '../design/tokens';
import type { FeedLikeState } from '../feed/feedLikeModel';
import { ReportSheet } from '../reports/ReportSheet';
import type { HomeFeedItem } from './homeData';

type SocialActivityListProps = {
  items: HomeFeedItem[];
  onOpenContent: (item: HomeFeedItem) => void;
  onSetLiked: (item: HomeFeedItem, liked: boolean) => Promise<FeedLikeState>;
};

export function SocialActivityList({ items, onOpenContent, onSetLiked }: SocialActivityListProps) {
  const { currentUser } = useAuthSession();
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <SocialReviewPost
          authorAvatarUrl={item.authorAvatarUrl}
          authorDisplayName={item.authorDisplayName}
          body={item.body}
          contentImageUrl={item.contentImageUrl}
          contentMeta={formatContentMeta(item)}
          contentTitle={item.contentTitle}
          key={item.id}
          likeCount={item.likeCount}
          likedByViewer={item.likedByViewer}
          onOpenContent={() => onOpenContent(item)}
          onReport={currentUser?.id === item.authorId ? undefined : () => setReportTarget({
            id: item.id,
            label: `Review by ${item.authorDisplayName?.trim() || 'Watchly member'}`,
            type: item.type,
          })}
          onSetLiked={(liked) => onSetLiked(item, liked)}
          rating={item.rating}
          updatedAt={item.updatedAt}
        />
      ))}
      <ReportSheet onClose={() => setReportTarget(null)} target={reportTarget} />
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
