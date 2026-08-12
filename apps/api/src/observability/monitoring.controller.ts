import {
  Controller,
  Headers,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isMonitoringKeyValid } from './monitoring-key';

@Controller('internal/monitoring')
export class MonitoringController {
  constructor(private readonly config: ConfigService) {}

  @Post('test-error')
  testError(@Headers('x-watchly-monitoring-key') providedKey?: string) {
    if (this.config.getOrThrow<string>('APP_ENV') !== 'staging') {
      throw new NotFoundException();
    }

    const expectedKey = this.config.get<string>('MONITORING_TEST_KEY');
    if (!isMonitoringKeyValid(providedKey, expectedKey)) {
      throw new UnauthorizedException();
    }

    throw new Error('Watchly staging error tracking verification');
  }
}
