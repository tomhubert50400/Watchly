import type { DocumentPickerAsset } from 'expo-document-picker';
import { ApiError, apiGet, apiPost, apiPostFormData } from './client';

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
  preparation?: { processed: number; total: number };
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

export async function previewDataImport(
  token: string,
  source: SupportedImportSource,
  asset: DocumentPickerAsset,
  onProgress?: (processed: number, total: number) => void,
) {
  const preview = await uploadImportFile(token, source, asset, 'preview?batch=true');
  return prepareDataImport(token, preview, onProgress);
}

export type ImportAnalysis = ImportPreview & { estimatedSeconds: number };

export type BackgroundImport = {
  importId: string;
  fileName: string;
  status: 'processing' | 'failed' | 'completed';
  phase: 'matching' | 'importing';
  processed: number;
  total: number;
  needsAttention: number;
  result: ImportResult | null;
};

export function analyzeDataImport(token: string, source: SupportedImportSource, asset: DocumentPickerAsset) {
  return uploadImportFile<ImportAnalysis>(token, source, asset, 'analyze');
}

export function startBackgroundImport(token: string, importId: string) {
  return apiPost<BackgroundImport>(`/imports/${encodeURIComponent(importId)}/background`, {}, { token });
}

export function cancelDataImport(token: string, importId: string) {
  return apiPost(`/imports/${encodeURIComponent(importId)}/cancel`, {}, { token });
}

export function listBackgroundImports(token: string) {
  return apiGet<{ imports: BackgroundImport[] }>('/imports/background', { token });
}

export function dismissBackgroundImport(token: string, importId: string) {
  return apiPost(`/imports/${encodeURIComponent(importId)}/dismiss`, {}, { token });
}

export function reviewBackgroundImport(token: string, importId: string) {
  return apiPost<ImportPreview>(`/imports/${encodeURIComponent(importId)}/review`, {}, { token });
}

function uploadImportFile<T = ImportPreview>(token: string, source: SupportedImportSource, asset: DocumentPickerAsset, operation: string) {
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

  return apiPostFormData<T>(`/imports/${source}/${operation}`, formData, {
    timeoutMs: 5 * 60_000,
    token,
  });
}

export async function prepareDataImport(token: string, initial: ImportPreview, onProgress?: (processed: number, total: number) => void) {
  let preview = initial;
  onProgress?.(preview.preparation?.processed ?? preview.items.length, preview.preparation?.total ?? preview.items.length);
  while (preview.preparation && preview.preparation.processed < preview.preparation.total) {
    preview = await postImportBatch<ImportPreview>(`/imports/${encodeURIComponent(preview.importId)}/prepare`, {
      timeoutMs: 5 * 60_000, token,
    });
    onProgress?.(preview.preparation?.processed ?? preview.items.length, preview.preparation?.total ?? preview.items.length);
  }
  return preview;
}

export async function confirmDataImport(token: string, importId: string, onProgress?: (processed: number) => void) {
  let result: ImportResult & { completed?: boolean };
  do {
    result = await postImportBatch<ImportResult & { completed?: boolean }>(
      `/imports/${encodeURIComponent(importId)}/confirm?batch=true`,
      { timeoutMs: 60_000, token },
    );
    onProgress?.(result.titlesProcessed);
  } while (result.completed === false);
  return result;
}

async function postImportBatch<T>(path: string, options: { token: string; timeoutMs: number }): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await apiPost<T>(path, {}, options);
    } catch (error) {
      if (attempt >= 3 || !(error instanceof ApiError)
        || (error.status !== undefined && error.status !== 409 && error.status !== 429 && error.status < 500)) throw error;
      await new Promise((resolve) => setTimeout(resolve, error.status === 429 ? 60_000 : 1_000 * (attempt + 1)));
    }
  }
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
