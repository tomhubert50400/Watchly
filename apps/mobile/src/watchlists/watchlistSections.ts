import type { PersonalWatchlistSection } from '../api/watchlists';
import type { HydratedPersonalWatchlistItem } from './WatchlistCacheContext';

export const MAX_PERSONAL_WATCHLIST_SECTIONS = 12;
export const SECTION_PREVIEW_ITEM_COUNT = 6;
export const UNSECTIONED_SECTION_ID = 'unsectioned';
const AUTO_SCROLL_EDGE = 88;
const AUTO_SCROLL_MAX_STEP = 12;

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

export function resolveCarriedPosterTilt(horizontalDelta: number) {
  return Math.max(-16, Math.min(16, horizontalDelta * -1.4));
}

export function resolveWatchlistAutoScrollDelta(pointY: number, viewportTop: number, viewportBottom: number) {
  if (pointY < viewportTop + AUTO_SCROLL_EDGE) {
    const strength = Math.min(1, (viewportTop + AUTO_SCROLL_EDGE - pointY) / AUTO_SCROLL_EDGE);
    return -Math.max(1, Math.ceil(AUTO_SCROLL_MAX_STEP * strength));
  }

  if (pointY > viewportBottom - AUTO_SCROLL_EDGE) {
    const strength = Math.min(1, (pointY - (viewportBottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE);
    return Math.max(1, Math.ceil(AUTO_SCROLL_MAX_STEP * strength));
  }

  return 0;
}
