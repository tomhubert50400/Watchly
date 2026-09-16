import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { strFromU8, unzipSync } from 'fflate';
import { basename } from 'node:path';

export type ImportSourceValue = 'imdb' | 'letterboxd' | 'tv-time';

export type ParsedImportItem = {
  watchlistKeys?: string[];
  identityIssue?: string;
  episodes?: { seasonNumber: number; episodeNumber: number; watchedDate: string | null; tvdbId?: number }[];
  activityDate: string | null;
  contentHint: 'episode' | 'movie' | 'series';
  favorite: boolean;
  imdbId: string | null;
  rating: number | null;
  review: string | null;
  sourceKey: string;
  sourceTitle: string;
  sourceYear: number | null;
  tmdbId: number | null;
  tvdbId: number | null;
  watched: boolean;
  watchedDates: string[];
  watching: boolean;
  watchlisted: boolean;
  warnings: string[];
};

export type ParsedImportFile = {
  watchlists: ParsedImportWatchlist[];
  ignoredFileCount: number;
  items: ParsedImportItem[];
};

type CsvRecord = Record<string, string>;
export type ParsedImportWatchlist = { key: string; name: string };
type CsvFile = { name: string; records: CsvRecord[]; watchlist?: ParsedImportWatchlist };

export function parseImportFile(
  source: ImportSourceValue,
  fileName: string,
  buffer: Buffer,
): ParsedImportFile {
  if (buffer.length === 0) {
    throw new BadRequestException('The selected import file is empty.');
  }

  const { files, ignoredFileCount } = readCsvFiles(source, fileName, buffer);
  const items = source === 'letterboxd'
    ? parseLetterboxdFiles(files)
    : source === 'tv-time'
      ? parseTvTimeFiles(files)
      : parseImdbFiles(files);

  const watchlists = files.flatMap((file) => file.watchlist ? [file.watchlist] : []);
  if (source === 'tv-time' && items.some((item) => item.watchlistKeys?.length)) {
    watchlists.push({ key: 'watchlist', name: 'Watchlist TV Time' });
  }
  if (items.length === 0 && watchlists.length === 0) {
    throw new BadRequestException(`No supported ${getSourceLabel(source)} rows were found.`);
  }

  return { ignoredFileCount, items, watchlists };
}

function readCsvFiles(source: ImportSourceValue, fileName: string, buffer: Buffer) {
  if (!isZip(fileName, buffer)) {
    if (!fileName.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Choose a CSV or ZIP export file.');
    }

    const entryBaseName = basename(fileName).toLowerCase();
    if (!isSupportedSourceFile(source, entryBaseName, buffer.toString('utf8', 0, 80))) {
      throw new BadRequestException(`Choose a supported ${getSourceLabel(source)} CSV export file.`);
    }

    return {
      files: [readCsvFile(source, fileName, buffer.toString('utf8'))],
      ignoredFileCount: 0,
    };
  }

  let archive: Record<string, Uint8Array>;
  try {
    assertSafeZip(buffer);
    archive = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new BadRequestException('The ZIP archive could not be opened.');
  }

  let ignoredFileCount = 0;
  let extractedBytes = 0;
  const files: CsvFile[] = [];

  for (const [entryName, content] of Object.entries(archive)) {
    const normalizedName = entryName.replaceAll('\\', '/').toLowerCase();
    const entryBaseName = basename(normalizedName);
    const isCsv = entryBaseName.endsWith('.csv');
    const isDeleted = normalizedName.startsWith('deleted/') || normalizedName.includes('/deleted/');
    const isSupportedFile = isSupportedSourceFile(source, normalizedName, strFromU8(content.subarray(0, 80)));

    if (!isCsv || isDeleted || !isSupportedFile) {
      if (isCsv) ignoredFileCount += 1;
      continue;
    }

    extractedBytes += content.byteLength;
    if (extractedBytes > MAX_EXTRACTED_BYTES) {
      throw new BadRequestException('The extracted archive is too large. Split the export into smaller files.');
    }

    files.push(readCsvFile(source, entryName, strFromU8(content)));
  }

  if (files.length === 0) {
    throw new BadRequestException('The ZIP archive does not contain a supported CSV export.');
  }

  return { files, ignoredFileCount };
}

function readCsvFile(source: ImportSourceValue, name: string, content: string): CsvFile {
  try {
    const rows = parse(content, {
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
    }) as string[][];
    const listExport = source === 'letterboxd' && rows[0]?.[0]?.startsWith('Letterboxd list export');
    const headerIndex = listExport
      ? rows.findIndex((row) => normalizeHeader(row[0] ?? '') === 'position' && row.some((cell) => normalizeHeader(cell) === 'name'))
      : 0;
    if (headerIndex < 0) throw new Error('Missing list headers');
    const headers = (rows[headerIndex] ?? []).map(normalizeHeader);
    const records = rows.slice(headerIndex + 1).map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
    const file: CsvFile = { name, records };
    const baseName = basename(name.replaceAll('\\', '/'));
    const stem = baseName.replace(/\.csv$/i, '');
    const isLetterboxdList = source === 'letterboxd' && (listExport || getLetterboxdFileRole(name) === 'watchlist');
    const isImdbList = source === 'imdb' && headers.some((header) => ['title', 'const', 'imdbid'].includes(header))
      && (headers.includes('position') || stem.toLowerCase() === 'watchlist' || !headers.includes('yourrating'));
    if (isLetterboxdList || isImdbList) {
      const metadataHeaders = (rows[1] ?? []).map(normalizeHeader);
      const metadata = listExport ? Object.fromEntries(metadataHeaders.map((header, index) => [header, rows[2]?.[index] ?? ''])) : {};
      const defaultList = stem.toLowerCase() === 'watchlist' && !listExport;
      file.watchlist = {
        key: metadata.url?.trim() || (defaultList ? 'watchlist' : `list:${stem}`),
        name: metadata.name?.trim() || (defaultList ? `Watchlist ${getSourceLabel(source)}` : stem),
      };
      if (file.watchlist.name.length > 80) {
        throw new BadRequestException(`Watchlist "${file.watchlist.name}" exceeds the 80-character name limit. Rename it before importing.`);
      }
    }
    return file;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('The CSV file could not be read. Check that it is a valid UTF-8 export.');
  }
}

function parseLetterboxdFiles(files: CsvFile[]) {
  const items = new Map<string, MutableParsedImportItem>();
  const orderedFiles = [...files].sort(
    (left, right) => getLetterboxdFilePriority(left.name) - getLetterboxdFilePriority(right.name),
  );

  orderedFiles.forEach((file) => {
    const role = getLetterboxdFileRole(file.name);

    file.records.forEach((record, index) => {
      const metadata = readMetadata(record, index, file.name, 'movie');
      if (!metadata) return;

      const item = items.get(metadata.sourceKey) ?? createMutableItem(metadata);
      const activityDate = readDate(record.date);
      const watchedDate = role === 'diary' || role === 'watched'
        ? readDate(record.watcheddate || record.date)
        : readDate(record.watcheddate);
      const rating = readLetterboxdRating(record);
      const review = readReview(record.review, item.warnings);

      if (file.watchlist) {
        item.watchlisted = true;
        addWatchlist(item, file.watchlist.key);
      } else {
        item.watched = true;
      }

      if (watchedDate && !file.watchlist) {
        item.watchedDates.add(watchedDate);
      }

      if (rating !== null) item.rating = rating;
      if (review !== null) item.review = review;
      item.activityDate = laterDate(item.activityDate, activityDate);
      mergeMetadata(item, metadata);
      items.set(metadata.sourceKey, item);
    });
  });

  return finalizeItems(items);
}

function parseImdbFiles(files: CsvFile[]) {
  const items = new Map<string, MutableParsedImportItem>();

  files.forEach((file) => {
    file.records.forEach((record, index) => {
      const contentHint = readImdbContentHint(record.titletype);
      const metadata = readMetadata(record, index, file.name, contentHint);
      if (!metadata) return;

      const item = items.get(metadata.sourceKey) ?? createMutableItem(metadata);
      const activityDate = readDate(record.daterated || record.date);

      if (record.yourrating?.trim()) {
        item.watched = true;
        item.activityDate = laterDate(item.activityDate, activityDate);

        const rating10 = Number(record.yourrating);
        if (Number.isInteger(rating10) && rating10 >= 1 && rating10 <= 10) {
          item.rating = rating10 / 2;
        } else if (record.yourrating?.trim()) {
          addWarning(item.warnings, 'Invalid IMDb rating was skipped.');
        }
      }
      if (file.watchlist) {
        item.watchlisted = true;
        addWatchlist(item, file.watchlist.key);
      }

      mergeMetadata(item, metadata);
      items.set(metadata.sourceKey, item);
    });
  });

  return finalizeItems(items);
}

function parseTvTimeFiles(files: CsvFile[]) {
  const items = new Map<string, MutableParsedImportItem>();
  const v2 = files.find((file) => basename(file.name).toLowerCase() === 'tracking-prod-records-v2.csv');
  const v2Series = new Map<string, CsvRecord>();
  const episodeRows = v2
    ? v2.records.filter((row) => row.key?.startsWith('watch-episode-'))
    : files.flatMap((file) => file.records).filter(
      (row) => row.type === 'watch' && row.entitytype === 'episode',
    );
  v2?.records.filter((row) => row.key?.startsWith('user-series-')).forEach((row) => {
    if (row.uuid) v2Series.set(row.uuid, row);
  });
  const seriesNames = new Map<number, string>();
  for (const file of files) {
    for (const row of file.records) {
      const isSeriesList = basename(file.name).toLowerCase() === 'user_tv_show_data.csv';
      if (!isSeriesList && !row.key?.startsWith('user-series-')) continue;
      const id = readPositiveInteger(isSeriesList ? row.tvshowid : row.sid);
      const name = (isSeriesList ? row.tvshowname : row.seriesname)?.trim();
      if (id && name && !seriesNames.has(id)) seriesNames.set(id, name);
    }
  }
  const episodeOwners = new Map<number, Set<number>>();
  for (const row of episodeRows) {
    const episodeId = readPositiveInteger(row.epid || row.episodeid);
    const seriesId = readPositiveInteger(v2Series.get(row.uuid)?.sid || row.sid || row.seriesid);
    if (!episodeId || !seriesId) continue;
    const owners = episodeOwners.get(episodeId) ?? new Set<number>();
    owners.add(seriesId);
    episodeOwners.set(episodeId, owners);
  }

  files.forEach((file) => {
    const fileName = basename(file.name).toLowerCase();

    if (fileName === 'user_tv_show_data.csv') {
      file.records.forEach((record) => {
        const tvdbId = readPositiveInteger(record.tvshowid);
        const sourceTitle = record.tvshowname?.trim() ?? '';
        const episodesSeen = readNonNegativeInteger(record.nbepisodesseen);

        if (!tvdbId || !sourceTitle || (episodesSeen === 0 && !readBooleanFlag(record.isfollowed))) return;

        const sourceKey = `tvdb:${tvdbId}`;
        const item = items.get(sourceKey) ?? createMutableItem({
          contentHint: 'series',
          imdbId: null,
          sourceKey,
          sourceTitle,
          sourceYear: null,
          tmdbId: null,
          tvdbId,
        });
        item.favorite ||= readBooleanFlag(record.isfavorited);
        item.watching = episodesSeen > 0;
        if (episodesSeen === 0) {
          item.watchlisted = true;
          addWatchlist(item, 'watchlist');
        }
        items.set(sourceKey, item);
      });
      return;
    }

    const movieRows = new Map<string, CsvRecord[]>();
    file.records.forEach((record) => {
      if (record.entitytype?.trim().toLowerCase() !== 'movie') return;

      const uuid = record.uuid?.trim();
      if (!uuid) return;

      const rows = movieRows.get(uuid) ?? [];
      rows.push(record);
      movieRows.set(uuid, rows);
    });

    movieRows.forEach((records, uuid) => {
      const sourceTitle = records.find((record) => record.moviename?.trim())?.moviename.trim() ?? '';
      const actionTypes = new Set(records.map((record) => record.type?.trim().toLowerCase()));
      const watched = actionTypes.has('watch');
      const watchlisted = actionTypes.has('towatch');

      if (!sourceTitle || (!watched && !watchlisted)) return;

      const sourceKey = `tv-time:${uuid}`;
      const item = items.get(sourceKey) ?? createMutableItem({
        contentHint: 'movie',
        imdbId: null,
        sourceKey,
        sourceTitle,
        sourceYear: readYearFromDate(records.find((record) => record.releasedate)?.releasedate),
        tmdbId: null,
        tvdbId: null,
      });
      item.watched ||= watched;
      item.watchlisted ||= watchlisted;
      if (watchlisted) addWatchlist(item, 'watchlist');
      records.forEach((record) => {
        const watchedDate = readDate(record.watchdate);
        if (watchedDate && record.type?.trim().toLowerCase() === 'watch') {
          item.watchedDates.add(watchedDate);
          item.activityDate = laterDate(item.activityDate, watchedDate);
        }
      });
      items.set(sourceKey, item);
    });
  });

  episodeRows.forEach((record) => {
    const series = v2 ? v2Series.get(record.uuid) : undefined;
    const tvdbId = readPositiveInteger(series?.sid || record.sid || record.seriesid);
    const sourceTitle = (record.seriesname || series?.seriesname || '').trim();
    const seasonValue = record.sno || record.seasonnumber;
    const seasonNumber = Number(seasonValue);
    const episodeNumber = readPositiveInteger(record.epno || record.episodenumber);
    if (!tvdbId || !sourceTitle || !seasonValue || !Number.isInteger(seasonNumber) || seasonNumber < 0 || !episodeNumber) return;

    const sourceKey = `tvdb:${tvdbId}`;
    const item = items.get(sourceKey) ?? createMutableItem({
      contentHint: 'series', imdbId: null, sourceKey, sourceTitle,
      sourceYear: null, tmdbId: null, tvdbId,
    });
    const tvdbEpisodeId = readPositiveInteger(record.epid || record.episodeid);
    const listedName = seriesNames.get(tvdbId);
    const issue = tvdbEpisodeId && (episodeOwners.get(tvdbEpisodeId)?.size ?? 0) > 1
      ? 'Conflicting series IDs were found for the same watched episode. These rows were skipped.'
      : seriesNames.size > 0 && !listedName
        ? 'This series appears only in episode rows and could not be verified against your series list.'
        : listedName && normalizeTitle(listedName) !== normalizeTitle(sourceTitle)
          ? 'The episode title conflicts with the series list. These rows were skipped.'
          : null;
    if (issue) {
      addWarning(item.warnings, issue);
      if (!item.episodes?.length) item.identityIssue = issue;
      items.set(sourceKey, item);
      return;
    }
    delete item.identityIssue;
    item.episodes ??= [];
    if (!item.episodes.some((episode) => episode.seasonNumber === seasonNumber && episode.episodeNumber === episodeNumber)) {
      item.episodes.push({
        seasonNumber, episodeNumber, watchedDate: readDate(record.watchdate || record.createdat),
        ...(tvdbEpisodeId ? { tvdbId: tvdbEpisodeId } : {}),
      });
    }
    item.watching = true;
    items.set(sourceKey, item);
  });
  for (const item of items.values()) {
    if (item.contentHint === 'series' && item.watching && !item.episodes?.length) {
      addWarning(item.warnings, 'No detailed watched episodes were found for this series. Progress could not be restored.');
    }
  }
  return finalizeItems(items);
}

type ImportMetadata = Pick<
  ParsedImportItem,
  'contentHint' | 'imdbId' | 'sourceKey' | 'sourceTitle' | 'sourceYear' | 'tmdbId' | 'tvdbId'
>;

type MutableParsedImportItem = Omit<ParsedImportItem, 'watchedDates'> & {
  watchedDates: Set<string>;
};

function readMetadata(
  record: CsvRecord,
  index: number,
  fileName: string,
  contentHint: ParsedImportItem['contentHint'],
): ImportMetadata | null {
  const sourceTitle = (record.title || record.name || '').trim();
  const tmdbId = readPositiveInteger(record.tmdbid);
  const imdbId = readImdbId(record.imdbid || record.const || record.url);
  const sourceYear = readYear(record.year);
  const uri = (record.letterboxduri || record.uri || (record.url?.includes('letterboxd.com/') ? record.url : '') || '').trim();

  if (!sourceTitle && !tmdbId && !imdbId && !uri) {
    return null;
  }

  const sourceKey = uri
    ? `letterboxd:${uri.toLowerCase()}`
    : tmdbId
      ? `tmdb:${tmdbId}`
      : imdbId
        ? `imdb:${imdbId}`
        : sourceTitle
          ? `title:${normalizeTitle(sourceTitle)}:${sourceYear ?? ''}`
          : `row:${fileName}:${index}`;

  return {
    contentHint,
    imdbId,
    sourceKey,
    sourceTitle: sourceTitle || `Title ${index + 1}`,
    sourceYear,
    tmdbId,
    tvdbId: null,
  };
}

function createMutableItem(metadata: ImportMetadata): MutableParsedImportItem {
  return {
    ...metadata,
    activityDate: null,
    favorite: false,
    rating: null,
    review: null,
    watched: false,
    watchedDates: new Set<string>(),
    watching: false,
    watchlisted: false,
    warnings: [],
  };
}

function addWatchlist(item: MutableParsedImportItem, key: string) {
  item.watchlistKeys ??= [];
  if (!item.watchlistKeys.includes(key)) item.watchlistKeys.push(key);
}

function laterDate(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  return !current || candidate > current ? candidate : current;
}

function mergeMetadata(item: MutableParsedImportItem, metadata: ImportMetadata) {
  item.contentHint = metadata.contentHint;
  item.imdbId ??= metadata.imdbId;
  item.sourceYear ??= metadata.sourceYear;
  item.tmdbId ??= metadata.tmdbId;
  item.tvdbId ??= metadata.tvdbId;
  if (item.sourceTitle.startsWith('Title ')) item.sourceTitle = metadata.sourceTitle;
}

function finalizeItems(items: Map<string, MutableParsedImportItem>): ParsedImportItem[] {
  return [...items.values()].map((item) => ({
    ...item,
    watchedDates: [...item.watchedDates].sort(),
    watching: item.watching && !item.watched,
    watchlisted: item.watchlisted && !item.watched && !item.watching,
  }));
}

function readLetterboxdRating(record: CsvRecord) {
  const ratingValue = record.rating?.trim();
  const rating10Value = record.rating10?.trim();
  const candidate = rating10Value ? Number(rating10Value) / 2 : Number(ratingValue);

  if (!ratingValue && !rating10Value) return null;
  return Number.isInteger(candidate * 2) && candidate >= 0.5 && candidate <= 5 ? candidate : null;
}

function readReview(value: string | undefined, warnings: string[]) {
  const review = htmlToPlainText(value?.trim() ?? '');
  if (!review) return null;

  if (review.length > MAX_IMPORTED_REVIEW_LENGTH) {
    addWarning(warnings, `Review longer than ${MAX_IMPORTED_REVIEW_LENGTH} characters was skipped.`);
    return null;
  }

  return review;
}

function htmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function readDate(value: string | undefined) {
  const candidate = value?.trim().slice(0, 10) ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;

  const date = new Date(`${candidate}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== candidate
    ? null
    : candidate;
}

function readYear(value: string | undefined) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1870 && year <= 2200 ? year : null;
}

function readPositiveInteger(value: string | undefined) {
  const integer = Number(value);
  return Number.isInteger(integer) && integer > 0 ? integer : null;
}

function readNonNegativeInteger(value: string | undefined) {
  const integer = Number(value);
  return Number.isInteger(integer) && integer >= 0 ? integer : 0;
}

function readBooleanFlag(value: string | undefined) {
  return value?.trim() === '1' || value?.trim().toLowerCase() === 'true';
}

function readYearFromDate(value: string | undefined) {
  const year = Number(value?.trim().slice(0, 4));
  return Number.isInteger(year) && year >= 1870 && year <= 2200 ? year : null;
}

function readImdbId(value: string | undefined) {
  const match = value?.match(/tt\d{5,12}/i);
  return match ? match[0].toLowerCase() : null;
}

function readImdbContentHint(value: string | undefined): ParsedImportItem['contentHint'] {
  const titleType = value?.trim().toLowerCase() ?? '';
  if (titleType.includes('episode')) return 'episode';
  if (titleType.includes('series') || titleType.includes('mini')) return 'series';
  return 'movie';
}

function getLetterboxdFileRole(fileName: string) {
  const normalizedName = fileName.replaceAll('\\', '/').toLowerCase();
  const name = basename(normalizedName);
  if (normalizedName.split('/').includes('lists')) return 'watchlist';
  if (name === 'watchlist.csv') return 'watchlist';
  if (name === 'diary.csv') return 'diary';
  if (name === 'reviews.csv') return 'reviews';
  if (name === 'ratings.csv') return 'ratings';
  return 'watched';
}

function getLetterboxdFilePriority(fileName: string) {
  const priorities = new Map([
    ['watched.csv', 0],
    ['watchlist.csv', 1],
    ['ratings.csv', 2],
    ['reviews.csv', 3],
    ['diary.csv', 4],
  ]);

  return priorities.get(basename(fileName).toLowerCase()) ?? 5;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeTitle(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function addWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function isZip(fileName: string, buffer: Buffer) {
  return fileName.toLowerCase().endsWith('.zip') || (buffer[0] === 0x50 && buffer[1] === 0x4b);
}

function assertSafeZip(buffer: Buffer) {
  const endOffset = findEndOfCentralDirectory(buffer);
  if (endOffset < 0) {
    throw new BadRequestException('The ZIP archive is invalid or unsupported.');
  }

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);

  if (
    entryCount === 0xffff
    || centralDirectorySize === 0xffffffff
    || centralDirectoryOffset === 0xffffffff
    || centralDirectoryOffset + centralDirectorySize > buffer.length
  ) {
    throw new BadRequestException('ZIP64 archives are not supported. Split the export into smaller files.');
  }

  let offset = centralDirectoryOffset;
  let extractedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + ZIP_CENTRAL_HEADER_BYTES > buffer.length || buffer.readUInt32LE(offset) !== ZIP_CENTRAL_SIGNATURE) {
      throw new BadRequestException('The ZIP archive directory is invalid.');
    }

    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);

    if (uncompressedSize === 0xffffffff) {
      throw new BadRequestException('ZIP64 archives are not supported. Split the export into smaller files.');
    }

    extractedBytes += uncompressedSize;
    if (extractedBytes > MAX_EXTRACTED_BYTES) {
      throw new BadRequestException('The extracted archive is too large. Split the export into smaller files.');
    }

    offset += ZIP_CENTRAL_HEADER_BYTES + fileNameLength + extraLength + commentLength;
  }
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - ZIP_MAX_END_SEARCH_BYTES);

  for (let offset = buffer.length - ZIP_END_HEADER_BYTES; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_SIGNATURE) return offset;
  }

  return -1;
}

const LETTERBOXD_EXPORT_FILES = new Set([
  'diary.csv',
  'ratings.csv',
  'reviews.csv',
  'watched.csv',
  'watchlist.csv',
]);
const TV_TIME_EXPORT_FILES = new Set([
  'tracking-prod-records-v2.csv',
  'tracking-prod-records.csv',
  'user_tv_show_data.csv',
]);

function isSupportedSourceFile(source: ImportSourceValue, fileName: string, prefix = '') {
  if (source === 'letterboxd') return LETTERBOXD_EXPORT_FILES.has(basename(fileName))
    || (fileName.endsWith('.csv') && (fileName.split('/').includes('lists') || prefix.replace(/^\uFEFF/, '').startsWith('Letterboxd list export')));
  if (source === 'tv-time') return TV_TIME_EXPORT_FILES.has(basename(fileName));
  return fileName.endsWith('.csv');
}

function getSourceLabel(source: ImportSourceValue) {
  if (source === 'tv-time') return 'TV Time';
  return source === 'imdb' ? 'IMDb' : 'Letterboxd';
}
const MAX_EXTRACTED_BYTES = 100 * 1024 * 1024;
const ZIP_CENTRAL_HEADER_BYTES = 46;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_END_HEADER_BYTES = 22;
const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP_MAX_END_SEARCH_BYTES = ZIP_END_HEADER_BYTES + 0xffff;
export const MAX_IMPORTED_REVIEW_LENGTH = 50_000;
