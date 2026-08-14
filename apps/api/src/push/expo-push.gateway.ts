import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_PUSH_TIMEOUT_MS = 10_000;

export type ExpoPushMessage = {
  body: string;
  channelId?: string;
  data: Record<string, string>;
  sound?: 'default';
  title: string;
  to: string;
};

export type ExpoPushResult = {
  details?: { error?: string };
  id?: string;
  message?: string;
  status: 'error' | 'ok';
};

@Injectable()
export class ExpoPushGateway {
  private readonly accessToken: string | undefined;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.accessToken = config.get<string>('EXPO_PUSH_ACCESS_TOKEN') || undefined;
  }

  async send(messages: ExpoPushMessage[], fetchImplementation: typeof fetch = fetch) {
    if (messages.length === 0) return [];
    if (messages.length > 100) throw new RangeError('Expo push batches cannot exceed 100 messages.');

    const response = await this.post<{ data?: ExpoPushResult[] }>(
      EXPO_PUSH_SEND_URL,
      messages,
      fetchImplementation,
    );

    if (!Array.isArray(response.data) || response.data.length !== messages.length) {
      throw new Error('Expo Push Service returned an invalid ticket response.');
    }

    return response.data;
  }

  async getReceipts(receiptIds: string[], fetchImplementation: typeof fetch = fetch) {
    if (receiptIds.length === 0) return {};
    if (receiptIds.length > 1000) throw new RangeError('Expo receipt batches cannot exceed 1000 IDs.');

    const response = await this.post<{ data?: Record<string, ExpoPushResult> }>(
      EXPO_PUSH_RECEIPTS_URL,
      { ids: receiptIds },
      fetchImplementation,
    );

    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Expo Push Service returned an invalid receipt response.');
    }

    return response.data;
  }

  private async post<T>(url: string, body: unknown, fetchImplementation: typeof fetch) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXPO_PUSH_TIMEOUT_MS);

    try {
      const response = await fetchImplementation(url, {
        body: JSON.stringify(body),
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        method: 'POST',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Expo Push Service rejected the request with status ${response.status}.`);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
