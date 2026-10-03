import { BadRequestException, ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { TrackedContentType, UserContentStatus } from '../generated/prisma/enums';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { SaveFavoriteOrderDto, TrackingContentType, TrackingStatus, UpsertContentStateDto } from './tracking.dto';
import { ViewingsService } from '../viewings/viewings.service';

@Injectable()
export class TrackingService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(ViewingsService) private readonly viewings?: ViewingsService,
  ) {}

  async listStates(identity: AuthenticatedIdentity, contentType?: TrackingContentType) {
    const userId = await this.getUserId(identity);
    const states = await this.prisma.withConnectionRetry(
      () =>
        this.prisma.userContentState.findMany({
          orderBy: {
            updatedAt: 'desc',
          },
          where: {
            userId,
            ...(contentType ? { contentType: toTrackedContentType(contentType) } : {}),
          },
        }),
    );

    return states.map(toApiState);
  }

  async getState(identity: AuthenticatedIdentity, contentType: TrackingContentType, tmdbId: number) {
    const userId = await this.getUserId(identity);
    const state = await this.prisma.withConnectionRetry(() =>
      this.prisma.userContentState.findUnique({
      where: {
        userId_contentType_tmdbId: {
          contentType: toTrackedContentType(contentType),
          tmdbId,
          userId,
        },
      },
      }),
    );

    return state ? toApiState(state) : null;
  }

  async upsertState(identity: AuthenticatedIdentity, input: UpsertContentStateDto) {
    if (!hasOwn(input, 'status') && !hasOwn(input, 'favorite')) {
      throw new BadRequestException('Provide status, favorite, or both.');
    }

    const userId = await this.getUserId(identity);
    const contentType = toTrackedContentType(input.contentType);
    const status = input.status ? toUserContentStatus(input.status) : null;
    const favorite = input.favorite ?? false;

    if (status === null && favorite === false) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.userContentState.deleteMany({
        where: {
          contentType,
          tmdbId: input.tmdbId,
          userId,
        },
        }),
      );

      return null;
    }

    const state = await this.prisma.withConnectionRetry(() =>
      this.prisma.userContentState.upsert({
      create: {
        contentType,
        favorite,
        status,
        tmdbId: input.tmdbId,
        userId,
      },
      update: {
        ...(hasOwn(input, 'favorite') ? { favorite, ...(!favorite ? { favoritePosition: null } : {}) } : {}),
        ...(hasOwn(input, 'status') ? { status } : {}),
      },
      where: {
        userId_contentType_tmdbId: {
          contentType,
          tmdbId: input.tmdbId,
          userId,
        },
      },
      }),
    );

    if (input.contentType === 'movie' && input.status === 'watched') {
      await this.viewings?.ensureInitialMovieViewing(userId, input.tmdbId);
    }

    return toApiState(state);
  }

  async deleteState(identity: AuthenticatedIdentity, contentType: TrackingContentType, tmdbId: number) {
    const userId = await this.getUserId(identity);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.userContentState.deleteMany({
      where: {
        contentType: toTrackedContentType(contentType),
        tmdbId,
        userId,
      },
      }),
    );
  }

  async saveFavoriteOrder(identity: AuthenticatedIdentity, input: SaveFavoriteOrderDto) {
    const userId = await this.getUserId(identity);
    const keys = input.items.map((item) => `${toTrackedContentType(item.contentType)}:${item.tmdbId}`);
    if (new Set(keys).size !== keys.length) throw new BadRequestException('Favorites must appear only once.');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const favorites = await tx.userContentState.findMany({ where: { userId, favorite: true } });
        const byKey = new Map(favorites.map((item) => [`${item.contentType}:${item.tmdbId}`, item]));
        if (favorites.length !== keys.length || keys.some((key) => !byKey.has(key))) {
          throw new ConflictException('Your favorites changed. Reopen the editor and try again.');
        }
        const saved = [];
        for (const [favoritePosition, key] of keys.entries()) {
          const state = byKey.get(key)!;
          saved.push(await tx.userContentState.update({
            where: { id: state.id },
            data: { favoritePosition, updatedAt: state.updatedAt },
          }));
        }
        return saved.map(toApiState);
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
        throw new ConflictException('Your favorites changed. Reopen the editor and try again.');
      }
      throw error;
    }
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }
}

type UserContentStateRecord = {
  contentType: TrackedContentType;
  favorite: boolean;
  favoritePosition: number | null;
  id: string;
  status: UserContentStatus | null;
  tmdbId: number;
  updatedAt: Date;
};

function toTrackedContentType(contentType: TrackingContentType): TrackedContentType {
  return contentType === 'movie' ? TrackedContentType.MOVIE : TrackedContentType.SERIES;
}

function fromTrackedContentType(contentType: TrackedContentType): TrackingContentType {
  return contentType === TrackedContentType.MOVIE ? 'movie' : 'series';
}

function toUserContentStatus(status: TrackingStatus): UserContentStatus {
  switch (status) {
    case 'watchlisted':
      return UserContentStatus.WATCHLISTED;
    case 'watching':
      return UserContentStatus.WATCHING;
    case 'watched':
      return UserContentStatus.WATCHED;
    case 'dropped':
      return UserContentStatus.DROPPED;
  }
}

function fromUserContentStatus(status: UserContentStatus | null): TrackingStatus | null {
  switch (status) {
    case UserContentStatus.WATCHLISTED:
      return 'watchlisted';
    case UserContentStatus.WATCHING:
      return 'watching';
    case UserContentStatus.WATCHED:
      return 'watched';
    case UserContentStatus.DROPPED:
      return 'dropped';
    default:
      return null;
  }
}

function toApiState(state: UserContentStateRecord) {
  return {
    contentType: fromTrackedContentType(state.contentType),
    favorite: state.favorite,
    favoritePosition: state.favoritePosition,
    id: state.id,
    status: fromUserContentStatus(state.status),
    tmdbId: state.tmdbId,
    updatedAt: state.updatedAt.toISOString(),
  };
}

function hasOwn<T extends object>(value: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
