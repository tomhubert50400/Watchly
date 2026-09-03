import { Body, Controller, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JoinWaitlistDto } from './waitlist.dto';
import { WaitlistService } from './waitlist.service';

@Controller('waitlist')
export class WaitlistController {
  constructor(@Inject(WaitlistService) private readonly waitlist: WaitlistService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  join(@Body() body: JoinWaitlistDto) {
    return this.waitlist.join(body);
  }
}
