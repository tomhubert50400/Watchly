import type { ViewingHistoryDate, ViewingHistoryItem } from '../api/viewings';

export function localViewingDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function toHistoryDraft(history: ViewingHistoryItem[]): ViewingHistoryDate[] {
  return history.map((item) => ({ id: item.id, watchedDate: item.watchedAt?.slice(0, 10) ?? null }));
}

export function resolveHistoryDraft(entries: ViewingHistoryDate[], previous: ViewingHistoryItem[], today: string) {
  return entries.map((entry): ViewingHistoryItem => {
    const date = entry.watchedDate ?? today;
    const old = previous.find((item) => item.id === entry.id);
    return { id: entry.id, watchedAt: old?.watchedAt?.slice(0, 10) === date ? old.watchedAt : `${date}T12:00:00.000Z` };
  });
}

export function resizeHistoryDraft(entries: ViewingHistoryDate[], count: number, createId: () => string): ViewingHistoryDate[] | null {
  if (!Number.isInteger(count) || count < 1 || count > 1000) return null;
  if (count < entries.filter((entry) => entry.watchedDate !== null).length) return null;
  const next = [...entries];
  while (next.length > count) next.splice(next.findLastIndex((entry) => entry.watchedDate === null), 1);
  while (next.length < count) next.push({ id: createId(), watchedDate: null });
  return next;
}

export function setHistoryDay(entries: ViewingHistoryDate[], date: string, amount: number): ViewingHistoryDate[] {
  const assigned = entries.filter((entry) => entry.watchedDate === date).length;
  let difference = amount - assigned;
  return entries.map((entry) => {
    if (difference > 0 && entry.watchedDate === null) { difference -= 1; return { ...entry, watchedDate: date }; }
    if (difference < 0 && entry.watchedDate === date) { difference += 1; return { ...entry, watchedDate: null }; }
    return entry;
  });
}

export function viewingCalendarDays(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const offset = (new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= count ? `${monthKey}-${String(day).padStart(2, '0')}` : null;
  });
}
