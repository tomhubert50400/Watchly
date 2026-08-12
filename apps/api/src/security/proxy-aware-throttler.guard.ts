import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type ProxyAwareRequest = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

export function resolveThrottlerTracker(request: ProxyAwareRequest) {
  const realIpHeader = request.headers?.['x-real-ip'];
  const realIp = Array.isArray(realIpHeader) ? realIpHeader[0] : realIpHeader;

  return realIp?.trim() || request.ip?.trim() || 'unknown';
}

@Injectable()
export class ProxyAwareThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: ProxyAwareRequest): Promise<string> {
    return resolveThrottlerTracker(request);
  }
}
