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
  const next = entries.slice(0, count);
  while (next.length < count) next.push({ id: createId(), watchedDate: null });
  return next;
}

export function setViewingDate(entries: ViewingHistoryDate[], id: string, date: string): ViewingHistoryDate[] {
  return entries.map((entry) => entry.id === id ? { ...entry, watchedDate: date } : entry);
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
