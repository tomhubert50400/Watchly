import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

export const AVATAR_CONTENT_TYPE = 'image/jpeg';
export const AVATAR_MAX_BYTES = 512 * 1024;
const AVATAR_UPLOAD_EXPIRY_SECONDS = 5 * 60;

type AvatarStorageConfig = {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
  publicBaseUrl: string;
  secretAccessKey: string;
};

@Injectable()
export class AvatarStorageService {
  private readonly logger = new Logger(AvatarStorageService.name);
  private readonly storageConfig: AvatarStorageConfig | null;
  private readonly client: S3Client | null;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.storageConfig = readStorageConfig(config);
    this.client = this.storageConfig
      ? new S3Client({
          credentials: {
            accessKeyId: this.storageConfig.accessKeyId,
            secretAccessKey: this.storageConfig.secretAccessKey,
          },
          endpoint: `https://${this.storageConfig.accountId}.r2.cloudflarestorage.com`,
          region: 'auto',
        })
      : null;
  }

  get uploadsEnabled() {
    return this.storageConfig !== null;
  }

  getPublicUrl(objectKey: string | null) {
    if (!objectKey || !this.storageConfig) return null;

    return `${this.storageConfig.publicBaseUrl}/${encodeObjectKey(objectKey)}`;
  }

  async createUpload(userId: string) {
    const { client, storageConfig } = this.requireStorage();
    const objectKey = `avatars/${userId}/${randomUUID()}.jpg`;
    const command = new PutObjectCommand({
      Bucket: storageConfig.bucketName,
      CacheControl: 'public, max-age=31536000, immutable',
      ContentType: AVATAR_CONTENT_TYPE,
      Key: objectKey,
    });
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: AVATAR_UPLOAD_EXPIRY_SECONDS,
    });

    return {
      contentType: AVATAR_CONTENT_TYPE,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': AVATAR_CONTENT_TYPE,
      },
      maxBytes: AVATAR_MAX_BYTES,
      objectKey,
      uploadUrl,
    };
  }

  async verifyUpload(userId: string, objectKey: string) {
    assertAvatarObjectOwnership(userId, objectKey);
    const { client, storageConfig } = this.requireStorage();

    let metadata;
    try {
      metadata = await client.send(new HeadObjectCommand({
        Bucket: storageConfig.bucketName,
        Key: objectKey,
      }));
    } catch {
      throw new BadRequestException('The uploaded profile photo could not be found.');
    }

    try {
      validateAvatarMetadata(metadata.ContentLength, metadata.ContentType);
    } catch (error) {
      await this.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async deleteObject(objectKey: string | null) {
    if (!objectKey) return;

    const { client, storageConfig } = this.requireStorage();
    await client.send(new DeleteObjectCommand({
      Bucket: storageConfig.bucketName,
      Key: objectKey,
    }));
  }

  async deleteObjectBestEffort(objectKey: string | null) {
    if (!objectKey || !this.storageConfig) return;

    try {
      await this.deleteObject(objectKey);
    } catch (error) {
      this.logger.warn(`Could not delete avatar object ${objectKey}: ${getErrorMessage(error)}`);
    }
  }

  private requireStorage() {
    if (!this.client || !this.storageConfig) {
      throw new ServiceUnavailableException(
        'Profile photo uploads are not configured on this environment.',
      );
    }

    return { client: this.client, storageConfig: this.storageConfig };
  }
}

export function assertAvatarObjectOwnership(userId: string, objectKey: string) {
  if (!objectKey.startsWith(`avatars/${userId}/`) || !objectKey.endsWith('.jpg')) {
    throw new BadRequestException('Invalid profile photo upload.');
  }
}

export function validateAvatarMetadata(
  contentLength: number | undefined,
  contentType: string | undefined,
) {
  if (contentType !== AVATAR_CONTENT_TYPE) {
    throw new BadRequestException('Profile photos must be JPEG images.');
  }

  if (!contentLength || contentLength > AVATAR_MAX_BYTES) {
    throw new BadRequestException('Profile photos must be 512 KB or smaller.');
  }
}

function readStorageConfig(config: ConfigService): AvatarStorageConfig | null {
  const values = {
    accessKeyId: config.get<string>('R2_ACCESS_KEY_ID')?.trim(),
    accountId: config.get<string>('R2_ACCOUNT_ID')?.trim(),
    bucketName: config.get<string>('R2_BUCKET_NAME')?.trim(),
    publicBaseUrl: config.get<string>('R2_PUBLIC_BASE_URL')?.trim().replace(/\/$/, ''),
    secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY')?.trim(),
  };

  if (Object.values(values).some((value) => !value)) return null;

  return values as AvatarStorageConfig;
}

function encodeObjectKey(objectKey: string) {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown storage error';
}
