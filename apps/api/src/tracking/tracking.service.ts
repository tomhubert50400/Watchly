import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { TrackedContentType, UserContentStatus } from '../generated/prisma/enums';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { TrackingContentType, TrackingStatus, UpsertContentStateDto } from './tracking.dto';

@Injectable()
export class TrackingService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
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
        ...(hasOwn(input, 'favorite') ? { favorite } : {}),
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

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }
}

type UserContentStateRecord = {
  contentType: TrackedContentType;
  favorite: boolean;
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
    id: state.id,
    status: fromUserContentStatus(state.status),
    tmdbId: state.tmdbId,
    updatedAt: state.updatedAt.toISOString(),
  };
}

function hasOwn<T extends object>(value: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
