import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { withPrismaConnectionRetry } from '../database/prisma-retry';
import { PrismaService } from '../database/prisma.service';
import { TrackedContentType } from '../generated/prisma/enums';
import { WatchlistContentType, WatchlistItemDto } from './watchlists.dto';

@Injectable()
export class WatchlistsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listWatchlists(
    identity: AuthenticatedIdentity,
    contentTypeFilter?: WatchlistContentType,
    tmdbIdFilter?: number,
  ) {
    const userId = await this.getUserId(identity);
    const itemFilter =
      contentTypeFilter && tmdbIdFilter
        ? {
            contentType: toTrackedContentType(contentTypeFilter),
            tmdbId: tmdbIdFilter,
          }
        : undefined;
    const watchlists = await withPrismaConnectionRetry(
      () =>
        this.prisma.personalWatchlist.findMany({
          include: {
            _count: {
              select: {
                items: true,
              },
            },
            items: {
              select: {
                id: true,
              },
              where: itemFilter,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          where: {
            userId,
          },
        }),
    );

    return {
      items: watchlists.map((watchlist) => toSummary(watchlist, Boolean(itemFilter))),
    };
  }

  async createWatchlist(identity: AuthenticatedIdentity, name: string) {
    const cleanName = name.trim();

    if (cleanName.length === 0) {
      throw new BadRequestException('name must not be empty.');
    }

    const userId = await this.getUserId(identity);
    const watchlist = await this.prisma.personalWatchlist.create({
      data: {
        name: cleanName,
        userId,
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return toSummary(watchlist);
  }

  async getWatchlist(identity: AuthenticatedIdentity, watchlistId: string) {
    const userId = await this.getUserId(identity);
    const watchlist = await this.prisma.personalWatchlist.findFirst({
      include: {
        items: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      where: {
        id: watchlistId,
        userId,
      },
    });

    if (!watchlist) {
      throw new NotFoundException('Watchlist not found.');
    }

    return {
      createdAt: watchlist.createdAt.toISOString(),
      id: watchlist.id,
      items: watchlist.items.map(toItem),
      name: watchlist.name,
      updatedAt: watchlist.updatedAt.toISOString(),
    };
  }

  async deleteWatchlist(identity: AuthenticatedIdentity, watchlistId: string) {
    const userId = await this.getUserId(identity);

    await this.prisma.personalWatchlist.deleteMany({
      where: {
        id: watchlistId,
        userId,
      },
    });
  }

  async addItem(identity: AuthenticatedIdentity, watchlistId: string, input: WatchlistItemDto) {
    const userId = await this.getUserId(identity);
    await this.assertOwnedWatchlist(userId, watchlistId);

    const contentType = toTrackedContentType(input.contentType);
    const item = await this.prisma.personalWatchlistItem.upsert({
      create: {
        contentType,
        tmdbId: input.tmdbId,
        watchlistId,
      },
      update: {},
      where: {
        watchlistId_contentType_tmdbId: {
          contentType,
          tmdbId: input.tmdbId,
          watchlistId,
        },
      },
    });

    await this.touchWatchlist(watchlistId);

    return toItem(item);
  }

  async removeItem(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    contentType: WatchlistContentType,
    tmdbId: number,
  ) {
    const userId = await this.getUserId(identity);
    await this.assertOwnedWatchlist(userId, watchlistId);

    await this.prisma.personalWatchlistItem.deleteMany({
      where: {
        contentType: toTrackedContentType(contentType),
        tmdbId,
        watchlistId,
      },
    });

    await this.touchWatchlist(watchlistId);
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async assertOwnedWatchlist(userId: string, watchlistId: string) {
    const watchlist = await this.prisma.personalWatchlist.findFirst({
      select: {
        id: true,
      },
      where: {
        id: watchlistId,
        userId,
      },
    });

    if (!watchlist) {
      throw new NotFoundException('Watchlist not found.');
    }
  }

  private async touchWatchlist(watchlistId: string) {
    await this.prisma.personalWatchlist.update({
      data: {
        updatedAt: new Date(),
      },
      where: {
        id: watchlistId,
      },
    });
  }
}

type WatchlistSummaryRecord = {
  _count: {
    items: number;
  };
  createdAt: Date;
  id: string;
  items?: {
    id: string;
  }[];
  name: string;
  updatedAt: Date;
};

type WatchlistItemRecord = {
  contentType: TrackedContentType;
  createdAt: Date;
  id: string;
  tmdbId: number;
};

function toSummary(watchlist: WatchlistSummaryRecord, includeContainsTitle = false) {
  return {
    ...(includeContainsTitle ? { containsTitle: (watchlist.items?.length ?? 0) > 0 } : {}),
    createdAt: watchlist.createdAt.toISOString(),
    id: watchlist.id,
    itemCount: watchlist._count.items,
    name: watchlist.name,
    updatedAt: watchlist.updatedAt.toISOString(),
  };
}

function toItem(item: WatchlistItemRecord) {
  return {
    contentType: fromTrackedContentType(item.contentType),
    createdAt: item.createdAt.toISOString(),
    id: item.id,
    tmdbId: item.tmdbId,
  };
}

function toTrackedContentType(contentType: WatchlistContentType): TrackedContentType {
  return contentType === 'movie' ? TrackedContentType.MOVIE : TrackedContentType.SERIES;
}

function fromTrackedContentType(contentType: TrackedContentType): WatchlistContentType {
  return contentType === TrackedContentType.MOVIE ? 'movie' : 'series';
}
