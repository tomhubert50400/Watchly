import { WatchlistCard } from '../library/WatchlistRail';

export type WatchlistOption = {
  containsTitle: boolean;
  id: string;
  itemCount: number;
  key: string;
  kind: 'personal' | 'shared';
  memberCount: number | null;
  name: string;
  posterUrls: Array<string | null>;
  updatedAt: string;
};

type WatchlistOptionRowProps = {
  isSelected: boolean;
  onPress: () => void;
  option: WatchlistOption;
};

export function WatchlistOptionRow({ isSelected, onPress, option }: WatchlistOptionRowProps) {
  const isShared = option.kind === 'shared';

  return (
    <WatchlistCard
      accessibilityHint={isShared ? 'Voting is available after the title is added.' : undefined}
      accessibilityLabel={`${option.name}, ${buildOptionMeta(option)}`}
      blendId={`watchlist-option-${option.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
      isSelectable
      isSelected={isSelected}
      name={option.name}
      onPress={onPress}
      posterUrls={option.posterUrls}
    />
  );
}

function buildOptionMeta(option: WatchlistOption) {
  const titleCount = `${option.itemCount} ${option.itemCount === 1 ? 'title' : 'titles'}`;

  if (option.kind === 'personal') {
    return `Private · ${titleCount}`;
  }

  const memberCount = option.memberCount ?? 0;
  return `Shared · ${memberCount} ${memberCount === 1 ? 'member' : 'members'} · ${titleCount}`;
}
