import { browseGenres, type BrowseFilters } from './discover-model';
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

  @Get('browse')
  @UseGuards(OptionalAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  browse(@Req() request: AuthenticatedRequest, @Query() query: Record<string, string>) {
    const { mood, genre, decade, awards, page = '1' } = query;
    if (mood && !discoverMoods.includes(mood as DiscoverMood)) throw new BadRequestException('Unknown mood.');
    if (genre && !Object.hasOwn(browseGenres, genre)) throw new BadRequestException('Unknown genre.');
    if (decade && !['1980', '1990', '2000', '2010', '2020'].includes(decade)) throw new BadRequestException('Unknown decade.');
    if (awards && awards !== 'true') throw new BadRequestException('Invalid awards filter.');
    if (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 50) throw new BadRequestException('Page must be between 1 and 50.');
    return this.discover.browse(request.authIdentity?.firebaseUid, { mood: mood as DiscoverMood | undefined, genre: genre as BrowseFilters['genre'], decade: decade ? Number(decade) : undefined, awards: awards === 'true' }, Number(page));
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
