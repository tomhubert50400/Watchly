import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { PrivacyVisibility, TrackedContentType } from '../generated/prisma/enums';
import { WatchlistContentType, WatchlistItemDto, WatchlistVisibility } from './watchlists.dto';

const MAX_PERSONAL_WATCHLIST_SECTIONS = 12;

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
    const watchlists = await this.withConnectionRetry(
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
    const watchlist = await this.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "users" WHERE id = ${userId}::uuid FOR UPDATE`;
        const count = await transaction.personalWatchlist.count({ where: { userId } });
        if (count >= 5) {
          throw new BadRequestException('You can have up to 5 personal watchlists. Delete a list before creating another.');
        }
        return transaction.personalWatchlist.create({
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
      }),
    );

    return toSummary(watchlist);
  }

  async getWatchlist(identity: AuthenticatedIdentity, watchlistId: string) {
    const userId = await this.getUserId(identity);
    const watchlist = await this.withConnectionRetry(() =>
      this.prisma.personalWatchlist.findFirst({
      include: {
        items: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        sections: {
          orderBy: {
            position: 'asc',
          },
        },
      },
      where: {
        id: watchlistId,
        userId,
      },
      }),
    );

    if (!watchlist) {
      throw new NotFoundException('Watchlist not found.');
    }

    return {
      createdAt: watchlist.createdAt.toISOString(),
      id: watchlist.id,
      items: watchlist.items.map(toItem),
      coverItemIds: watchlist.coverItemIds.filter((id) => watchlist.items.some((item) => item.id === id)),
      name: watchlist.name,
      sections: watchlist.sections.map(toSection),
      updatedAt: watchlist.updatedAt.toISOString(),
      visibility: fromPrivacyVisibility(watchlist.visibility),
    };
  }

  async updateVisibility(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    visibility: WatchlistVisibility,
  ) {
    const userId = await this.getUserId(identity);
    await this.assertOwnedWatchlist(userId, watchlistId);

    const watchlist = await this.withConnectionRetry(() =>
      this.prisma.personalWatchlist.update({
        data: {
          visibility: toPrivacyVisibility(visibility),
        },
        include: {
          _count: {
            select: {
              items: true,
            },
          },
        },
        where: {
          id: watchlistId,
        },
      }),
    );

    return toSummary(watchlist);
  }

  async deleteWatchlist(identity: AuthenticatedIdentity, watchlistId: string) {
    const userId = await this.getUserId(identity);

    await this.withConnectionRetry(() =>
      this.prisma.personalWatchlist.deleteMany({
      where: {
        id: watchlistId,
        userId,
      },
      }),
    );
  }

  async addItem(identity: AuthenticatedIdentity, watchlistId: string, input: WatchlistItemDto) {
    const userId = await this.getUserId(identity);
    await this.assertOwnedWatchlist(userId, watchlistId);

    const contentType = toTrackedContentType(input.contentType);
    const item = await this.withConnectionRetry(() =>
      this.prisma.personalWatchlistItem.upsert({
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
      }),
    );

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

    await this.withConnectionRetry(() =>
      this.prisma.personalWatchlistItem.deleteMany({
      where: {
        contentType: toTrackedContentType(contentType),
        tmdbId,
        watchlistId,
      },
      }),
    );

    await this.touchWatchlist(watchlistId);
  }

  async createSection(identity: AuthenticatedIdentity, watchlistId: string, name: string) {
    const cleanName = cleanSectionName(name);
    const userId = await this.getUserId(identity);

    return this.withConnectionRetry(() => this.prisma.$transaction(async (transaction) => {
      await lockOwnedWatchlist(transaction, userId, watchlistId);
      const sectionCount = await transaction.personalWatchlistSection.count({ where: { watchlistId } });
      if (sectionCount >= MAX_PERSONAL_WATCHLIST_SECTIONS) {
        throw new BadRequestException(`You can create up to ${MAX_PERSONAL_WATCHLIST_SECTIONS} sections in a watchlist.`);
      }
      const duplicate = await transaction.personalWatchlistSection.findFirst({
        where: { watchlistId, name: { equals: cleanName, mode: 'insensitive' } },
      });
      if (duplicate) throw new BadRequestException('A section with this name already exists.');
      const lastSection = await transaction.personalWatchlistSection.findFirst({
        orderBy: { position: 'desc' },
        select: { position: true },
        where: { watchlistId },
      });
      const section = await transaction.personalWatchlistSection.create({
        data: { name: cleanName, position: (lastSection?.position ?? -1) + 1, watchlistId },
      });
      await transaction.personalWatchlist.update({
        data: { updatedAt: new Date() },
        where: { id: watchlistId },
      });
      return toSection(section);
    }));
  }

  async updateSection(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    sectionId: string,
    name: string,
  ) {
    const cleanName = cleanSectionName(name);
    const userId = await this.getUserId(identity);

    return this.withConnectionRetry(() => this.prisma.$transaction(async (transaction) => {
      await lockOwnedWatchlist(transaction, userId, watchlistId);
      const section = await transaction.personalWatchlistSection.findFirst({
        where: { id: sectionId, watchlistId },
      });
      if (!section) throw new NotFoundException('Watchlist section not found.');
      const duplicate = await transaction.personalWatchlistSection.findFirst({
        where: {
          id: { not: sectionId },
          name: { equals: cleanName, mode: 'insensitive' },
          watchlistId,
        },
      });
      if (duplicate) throw new BadRequestException('A section with this name already exists.');
      const updated = await transaction.personalWatchlistSection.update({
        data: { name: cleanName },
        where: { id: sectionId },
      });
      await transaction.personalWatchlist.update({
        data: { updatedAt: new Date() },
        where: { id: watchlistId },
      });
      return toSection(updated);
    }));
  }

  async deleteSection(identity: AuthenticatedIdentity, watchlistId: string, sectionId: string) {
    const userId = await this.getUserId(identity);

    await this.withConnectionRetry(() => this.prisma.$transaction(async (transaction) => {
      await lockOwnedWatchlist(transaction, userId, watchlistId);
      const deleted = await transaction.personalWatchlistSection.deleteMany({
        where: { id: sectionId, watchlistId },
      });
      if (deleted.count === 0) throw new NotFoundException('Watchlist section not found.');
      await transaction.personalWatchlist.update({
        data: { updatedAt: new Date() },
        where: { id: watchlistId },
      });
    }));
  }

  async moveItemToSection(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    itemId: string,
    sectionId: string | null,
  ) {
    const userId = await this.getUserId(identity);

    return this.withConnectionRetry(() => this.prisma.$transaction(async (transaction) => {
      await lockOwnedWatchlist(transaction, userId, watchlistId);
      const item = await transaction.personalWatchlistItem.findFirst({
        where: { id: itemId, watchlistId },
      });
      if (!item) throw new NotFoundException('Watchlist item not found.');
      if (sectionId) {
        const section = await transaction.personalWatchlistSection.findFirst({
          select: { id: true },
          where: { id: sectionId, watchlistId },
        });
        if (!section) throw new BadRequestException('The destination section does not belong to this watchlist.');
      }
      const updated = await transaction.personalWatchlistItem.update({
        data: { sectionId },
        where: { id: itemId },
      });
      await transaction.personalWatchlist.update({
        data: { updatedAt: new Date() },
        where: { id: watchlistId },
      });
      return toItem(updated);
    }));
  }

  async updateCover(identity: AuthenticatedIdentity, watchlistId: string, itemIds: string[]) {
    if (itemIds.length > 4 || new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException('Choose up to 4 different titles.');
    }
    const userId = await this.getUserId(identity);
    return this.withConnectionRetry(() => this.prisma.$transaction(async (transaction) => {
      const watchlist = await transaction.personalWatchlist.findFirst({
        where: { id: watchlistId, userId },
        include: { items: { select: { id: true } } },
      });
      if (!watchlist) throw new NotFoundException('Watchlist not found.');
      if (itemIds.some((id) => !watchlist.items.some((item) => item.id === id))) {
        throw new BadRequestException('Cover titles must belong to this watchlist.');
      }
      await transaction.personalWatchlist.update({
        where: { id: watchlistId },
        data: { coverItemIds: itemIds },
      });
      return { coverItemIds: itemIds };
    }));
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async withConnectionRetry<T>(operation: () => Promise<T>) {
    return this.prisma.withConnectionRetry(operation);
  }

  private async assertOwnedWatchlist(userId: string, watchlistId: string) {
    const watchlist = await this.withConnectionRetry(() =>
      this.prisma.personalWatchlist.findFirst({
      select: {
        id: true,
      },
      where: {
        id: watchlistId,
        userId,
      },
      }),
    );

    if (!watchlist) {
      throw new NotFoundException('Watchlist not found.');
    }
  }

  private async touchWatchlist(watchlistId: string) {
    await this.withConnectionRetry(() =>
      this.prisma.personalWatchlist.update({
      data: {
        updatedAt: new Date(),
      },
      where: {
        id: watchlistId,
      },
      }),
    );
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
  visibility: PrivacyVisibility;
};

type WatchlistItemRecord = {
  contentType: TrackedContentType;
  createdAt: Date;
  id: string;
  sectionId: string | null;
  tmdbId: number;
};

type WatchlistSectionRecord = {
  createdAt: Date;
  id: string;
  name: string;
  position: number;
  updatedAt: Date;
};

function toSummary(watchlist: WatchlistSummaryRecord, includeContainsTitle = false) {
  return {
    ...(includeContainsTitle ? { containsTitle: (watchlist.items?.length ?? 0) > 0 } : {}),
    createdAt: watchlist.createdAt.toISOString(),
    id: watchlist.id,
    itemCount: watchlist._count.items,
    name: watchlist.name,
    updatedAt: watchlist.updatedAt.toISOString(),
    visibility: fromPrivacyVisibility(watchlist.visibility),
  };
}

function toItem(item: WatchlistItemRecord) {
  return {
    contentType: fromTrackedContentType(item.contentType),
    createdAt: item.createdAt.toISOString(),
    id: item.id,
    sectionId: item.sectionId,
    tmdbId: item.tmdbId,
  };
}

function toSection(section: WatchlistSectionRecord) {
  return {
    createdAt: section.createdAt.toISOString(),
    id: section.id,
    name: section.name,
    position: section.position,
    updatedAt: section.updatedAt.toISOString(),
  };
}

function cleanSectionName(name: string) {
  const cleanName = name.trim();
  if (cleanName.length === 0) throw new BadRequestException('name must not be empty.');
  return cleanName;
}

async function lockOwnedWatchlist(
  transaction: Pick<PrismaService, '$queryRaw'>,
  userId: string,
  watchlistId: string,
) {
  const rows = await transaction.$queryRaw<{ id: string }[]>`
    SELECT id FROM "personal_watchlists"
    WHERE id = ${watchlistId}::uuid AND "userId" = ${userId}::uuid
    FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundException('Watchlist not found.');
}

function toTrackedContentType(contentType: WatchlistContentType): TrackedContentType {
  return contentType === 'movie' ? TrackedContentType.MOVIE : TrackedContentType.SERIES;
}

function fromTrackedContentType(contentType: TrackedContentType): WatchlistContentType {
  return contentType === TrackedContentType.MOVIE ? 'movie' : 'series';
}

function toPrivacyVisibility(visibility: WatchlistVisibility) {
  return visibility === 'public' ? PrivacyVisibility.PUBLIC : PrivacyVisibility.PRIVATE;
}

function fromPrivacyVisibility(visibility: PrivacyVisibility): WatchlistVisibility {
  return visibility === PrivacyVisibility.PUBLIC ? 'public' : 'private';
}
