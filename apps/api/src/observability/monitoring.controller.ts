import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReleaseEventsService } from '../release-events/release-events.service';
import { isMonitoringKeyValid } from './monitoring-key';

@Controller('internal/monitoring')
export class MonitoringController {
  constructor(
    private readonly config: ConfigService,
    private readonly releaseEvents: ReleaseEventsService,
  ) {}

  @Get('release-events')
  async getReleaseEventSyncStatus(
    @Headers('x-watchly-monitoring-key') providedKey?: string,
  ) {
    this.assertMonitoringAccess(providedKey);

    return {
      latestRun: await this.releaseEvents.getLatestSyncRun(),
    };
  }

  @Post('test-error')
  testError(@Headers('x-watchly-monitoring-key') providedKey?: string) {
    this.assertMonitoringAccess(providedKey, true);

    throw new Error('Watchly staging error tracking verification');
  }

  private assertMonitoringAccess(providedKey?: string, stagingOnly = false) {
    const environment = this.config.getOrThrow<string>('APP_ENV');
    if (environment === 'development' || (stagingOnly && environment !== 'staging')) {
      throw new NotFoundException();
    }

    const expectedKey = this.config.get<string>('MONITORING_TEST_KEY');
    if (!isMonitoringKeyValid(providedKey, expectedKey)) {
      throw new UnauthorizedException();
    }
  }
}
