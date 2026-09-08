import { BadRequestException, Controller, Get, Header, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { DiscoverService } from './discover.service';
import { discoverCollections, discoverMoods, type DiscoverMood } from './discover-model';

@Controller('catalog/discover')
export class DiscoverController {
  constructor(@Inject(DiscoverService) private readonly discover: DiscoverService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  home(@Req() request: AuthenticatedRequest, @Query('mood') mood?: string) {
    if (mood && !discoverMoods.includes(mood as DiscoverMood)) throw new BadRequestException('Unknown mood.');
    return this.discover.home(request.authIdentity?.firebaseUid, mood ? mood as DiscoverMood : null);
  }

  @Get('collections')
  collections() { return this.discover.collections(); }

  @Get('collections/:id')
  collection(@Param('id') id: string, @Query('page') page = '1') {
    const collection = discoverCollections.find(item => item.id === id);
    if (!collection) throw new BadRequestException('Unknown collection.');
    if (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 50) throw new BadRequestException('Page must be between 1 and 50.');
    return this.discover.collection(collection.id, Number(page));
  }
}
