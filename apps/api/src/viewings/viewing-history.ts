import { BadRequestException } from '@nestjs/common';
import { SaveViewingHistoryDto } from './viewing-history.dto';

export function resolveViewingHistory(input: SaveViewingHistoryDto, now = new Date()) {
  if (input.contentType === 'episode' && (input.seasonNumber == null || input.episodeNumber == null)) {
    throw new BadRequestException('Select an episode.');
  }
  if (!input.entries.length) throw new BadRequestException('Keep at least one viewing.');
  let today: string;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: input.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    today = ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)!.value).join('-');
  } catch {
    throw new BadRequestException('Invalid time zone.');
  }
  if (new Set(input.entries.map((entry) => entry.id)).size !== input.entries.length ||
      new Set(input.previous.map((entry) => entry.id)).size !== input.previous.length) {
    throw new BadRequestException('Duplicate viewing IDs.');
  }
  return input.entries.map((entry) => {
    const date = entry.watchedDate ?? today;
    const parsed = new Date(`${date}T12:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date || date > today) {
      throw new BadRequestException('Choose a valid date no later than today.');
    }
    const previous = input.previous.find((item) => item.id === entry.id);
    return {
      id: entry.id,
      watchedAt: previous?.watchedAt?.slice(0, 10) === date ? new Date(previous.watchedAt) : parsed,
    };
  });
}

export function historyMatches(
  current: { id: string; watchedAt: Date | null }[],
  expected: { id: string; watchedAt: string | null }[],
) {
  return current.length === expected.length && current.every((item) =>
    expected.some((entry) => entry.id === item.id && entry.watchedAt === (item.watchedAt?.toISOString() ?? null)),
  );
}
