import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrivacyVisibility, SharedWatchlistVisibility } from '../generated/prisma/enums';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import {
  PrivacyVisibilityValue,
  SharedWatchlistVisibilityValue,
  UpdatePrivacySettingsDto,
  UpdateProfileDto,
} from './profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getProfile(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);

    return this.getProfileByUserId(userId);
  }

  async updateProfile(identity: AuthenticatedIdentity, input: UpdateProfileDto) {
    if (!hasOwn(input, 'displayName')) {
      throw new BadRequestException('displayName is required.');
    }

    const userId = await this.getUserId(identity);
    const displayName = normalizeDisplayName(input.displayName);

    await this.prisma.user.update({
      data: {
        displayName,
      },
      where: {
        id: userId,
      },
    });

    return this.getProfileByUserId(userId);
  }

  async updatePrivacy(identity: AuthenticatedIdentity, input: UpdatePrivacySettingsDto) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('Provide at least one privacy setting.');
    }

    const userId = await this.getUserId(identity);
    const profileVisibility = input.profileVisibility
      ? toPrivacyVisibility(input.profileVisibility)
      : undefined;

    await this.prisma.privacySettings.upsert({
      create: {
        episodeProgressVisibility: input.episodeProgressVisibility
          ? toPrivacyVisibility(input.episodeProgressVisibility)
          : undefined,
        profileVisibility,
        ratingsVisibility: input.ratingsVisibility
          ? toPrivacyVisibility(input.ratingsVisibility)
          : undefined,
        reviewsVisibility: profileVisibility,
        sharedWatchlistVisibility: input.sharedWatchlistVisibility
          ? toSharedWatchlistVisibility(input.sharedWatchlistVisibility)
          : undefined,
        userId,
        viewingHistoryVisibility: input.viewingHistoryVisibility
          ? toPrivacyVisibility(input.viewingHistoryVisibility)
          : undefined,
      },
      update: {
        ...(input.episodeProgressVisibility
          ? { episodeProgressVisibility: toPrivacyVisibility(input.episodeProgressVisibility) }
          : {}),
        ...(profileVisibility
          ? { profileVisibility, reviewsVisibility: profileVisibility }
          : {}),
        ...(input.ratingsVisibility
          ? { ratingsVisibility: toPrivacyVisibility(input.ratingsVisibility) }
          : {}),
        ...(input.sharedWatchlistVisibility
          ? { sharedWatchlistVisibility: toSharedWatchlistVisibility(input.sharedWatchlistVisibility) }
          : {}),
        ...(input.viewingHistoryVisibility
          ? { viewingHistoryVisibility: toPrivacyVisibility(input.viewingHistoryVisibility) }
          : {}),
      },
      where: {
        userId,
      },
    });

    return this.getProfileByUserId(userId);
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async getProfileByUserId(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      include: {
        privacySettings: true,
      },
      where: {
        id: userId,
      },
    });

    const privacySettings =
      user.privacySettings ??
      (await this.prisma.privacySettings.create({
        data: {
          userId,
        },
      }));

    return {
      displayName: user.displayName,
      id: user.id,
      privacy: {
        episodeProgressVisibility: fromPrivacyVisibility(
          privacySettings.episodeProgressVisibility,
        ),
        profileVisibility: fromPrivacyVisibility(privacySettings.profileVisibility),
        ratingsVisibility: fromPrivacyVisibility(privacySettings.ratingsVisibility),
        reviewsFollowProfileVisibility: true,
        sharedWatchlistVisibility: fromSharedWatchlistVisibility(
          privacySettings.sharedWatchlistVisibility,
        ),
        viewingHistoryVisibility: fromPrivacyVisibility(
          privacySettings.viewingHistoryVisibility,
        ),
      },
    };
  }
}

function normalizeDisplayName(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const displayName = value.trim();

  return displayName.length > 0 ? displayName : null;
}

function hasOwn<T extends object>(value: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function toPrivacyVisibility(value: PrivacyVisibilityValue) {
  return value === 'public' ? PrivacyVisibility.PUBLIC : PrivacyVisibility.PRIVATE;
}

function fromPrivacyVisibility(value: PrivacyVisibility): PrivacyVisibilityValue {
  return value === PrivacyVisibility.PUBLIC ? 'public' : 'private';
}

function toSharedWatchlistVisibility(value: SharedWatchlistVisibilityValue) {
  return value === 'members'
    ? SharedWatchlistVisibility.MEMBERS
    : SharedWatchlistVisibility.PRIVATE;
}

function fromSharedWatchlistVisibility(
  value: SharedWatchlistVisibility,
): SharedWatchlistVisibilityValue {
  return value === SharedWatchlistVisibility.MEMBERS ? 'members' : 'private';
}
