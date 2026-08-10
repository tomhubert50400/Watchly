import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { AvatarStorageService } from './avatar-storage.service';

const SMOKE_USER_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  const storage = new AvatarStorageService(new ConfigService(process.env));
  let objectKey: string | null = null;

  if (!storage.uploadsEnabled) {
    throw new Error('R2 avatar storage is not fully configured.');
  }

  try {
    const upload = await storage.createUpload(SMOKE_USER_ID);
    objectKey = upload.objectKey;
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
      type: upload.contentType,
    });
    const uploaded = await fetch(upload.uploadUrl, {
      body: jpeg,
      headers: upload.headers,
      method: 'PUT',
    });

    if (!uploaded.ok) {
      throw new Error(`R2 upload returned HTTP ${uploaded.status}.`);
    }

    await storage.verifyUpload(SMOKE_USER_ID, objectKey);
    const publicUrl = storage.getPublicUrl(objectKey);
    const publiclyReadable = publicUrl ? await fetchPublicObject(publicUrl) : null;

    if (!publiclyReadable?.ok) {
      throw new Error(
        `R2 public URL returned HTTP ${publiclyReadable?.status ?? 'unavailable'}.`,
      );
    }

    if (publiclyReadable.headers.get('content-type') !== upload.contentType) {
      throw new Error('R2 public URL returned an unexpected content type.');
    }

    console.log('R2 avatar storage smoke passed.');
  } finally {
    await storage.deleteObjectBestEffort(objectKey);
  }
}

async function fetchPublicObject(url: string) {
  let response: Response | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(url);
    if (response.ok) return response;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return response;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'R2 storage smoke failed.');
  process.exitCode = 1;
});
