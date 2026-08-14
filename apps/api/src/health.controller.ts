import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  @Get()
  health() {
    return {
      environment: this.config.getOrThrow<string>('APP_ENV'),
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
