import type { DocumentPickerAsset } from 'expo-document-picker';
import { apiGet, apiPost, apiPostFormData } from './client';

export type SupportedImportSource = 'imdb' | 'letterboxd' | 'tv-time';

export type ImportMatch = {
  contentType: 'movie' | 'series';
  posterUrl: string | null;
  releaseDate: string | null;
  title: string;
  tmdbId: number;
};

export type ImportPreviewItem = {
  actions: {
    hasReview: boolean;
    favorite: boolean;
    rating: number | null;
    sourceRating: number | null;
    viewingCount: number;
    watched: boolean;
    watching: boolean;
    watchlisted: boolean;
  };
  importId: string;
  itemIndex: number;
  issues: string[];
  match: ImportMatch | null;
  sourceTitle: string;
  sourceYear: number | null;
  status: 'ambiguous' | 'ready' | 'unmatched' | 'unsupported';
  suggestion: ImportMatch | null;
};

export type ImportPreview = {
  fileName: string;
  ignoredFileCount: number;
  importId: string;
  items: ImportPreviewItem[];
  source: SupportedImportSource;
  summary: {
    favorites: number;
    needsAttention: number;
    ratings: number;
    ready: number;
    reviews: number;
    total: number;
    watched: number;
    watching: number;
    watchlisted: number;
  };
};

export type ImportResult = {
  alreadyCompleted?: boolean;
  preservedExisting: number;
  ratingsCreated: number;
  reviewsCreated: number;
  statesChanged: number;
  titlesProcessed: number;
  viewingEventsCreated: number;
};

export function previewDataImport(
  token: string,
  source: SupportedImportSource,
  asset: DocumentPickerAsset,
) {
  const formData = new FormData();

  if (asset.file) {
    formData.append('file', asset.file);
  } else {
    formData.append('file', {
      name: asset.name,
      type: asset.mimeType || inferMimeType(asset.name),
      uri: asset.uri,
    } as unknown as Blob);
  }

  return apiPostFormData<ImportPreview>(`/imports/${source}/preview`, formData, {
    timeoutMs: 5 * 60_000,
    token,
  });
}

export function confirmDataImport(token: string, importId: string) {
  return apiPost<ImportResult>(
    `/imports/${encodeURIComponent(importId)}/confirm`,
    {},
    { timeoutMs: 60_000, token },
  );
}

export function getImportPreview(token: string, importId: string) {
  return apiGet<ImportPreview>(
    `/imports/${encodeURIComponent(importId)}/preview`,
    { token },
  );
}

export function retryImportSuggestion(token: string, importId: string, itemIndex: number) {
  return apiPost<ImportPreview>(
    `/imports/${encodeURIComponent(importId)}/items/${itemIndex}/retry`,
    {},
    { token },
  );
}

function inferMimeType(fileName: string) {
  return fileName.toLowerCase().endsWith('.zip') ? 'application/zip' : 'text/csv';
}
