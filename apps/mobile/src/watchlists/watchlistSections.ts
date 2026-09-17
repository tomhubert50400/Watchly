import type { PersonalWatchlistSection } from '../api/watchlists';
import type { HydratedPersonalWatchlistItem } from './WatchlistCacheContext';

export const MAX_PERSONAL_WATCHLIST_SECTIONS = 12;
export const SECTION_PREVIEW_ITEM_COUNT = 6;
export const UNSECTIONED_SECTION_ID = 'unsectioned';

export type PersonalWatchlistItemGroup = {
  id: string;
  items: HydratedPersonalWatchlistItem[];
  name: string;
  section: PersonalWatchlistSection | null;
};

export function groupPersonalWatchlistItems(
  sections: PersonalWatchlistSection[],
  items: HydratedPersonalWatchlistItem[],
) {
  const groups: PersonalWatchlistItemGroup[] = sections.map((section) => ({
    id: section.id,
    items: items.filter((item) => item.sectionId === section.id),
    name: section.name,
    section,
  }));
  const unsectioned = items.filter((item) => !item.sectionId || !sections.some((section) => section.id === item.sectionId));

  groups.push({
    id: UNSECTIONED_SECTION_ID,
    items: unsectioned,
    name: 'Unsectioned',
    section: null,
  });

  return groups;
}

export function resolveDestinationSectionId(groupId: string) {
  return groupId === UNSECTIONED_SECTION_ID ? null : groupId;
}
