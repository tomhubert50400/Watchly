import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAuth } from 'firebase-admin/auth';
import {
  AuditAction,
  AuthProvider,
  DataImportStatus,
  FollowStatus,
  PrivacyVisibility,
  SharedWatchlistVisibility,
  TrackedContentType,
  UserContentStatus,
} from '../generated/prisma/enums';
import { assertUuid } from '../blocks/blocks.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { AvatarStorageService } from '../media/avatar-storage.service';
import { activeAccountWhere } from '../moderation/account-suspension';
import { ViewingsService } from '../viewings/viewings.service';
import {
  PrivacyVisibilityValue,
  CompleteOnboardingDto,
  SharedWatchlistVisibilityValue,
  UpdateProfileBackdropDto,
  UpdatePrivacySettingsDto,
  UpdateProfileDto,
} from './profile.dto';
import {
  isProfileBackdropEligible,
  normalizeProfileBackdropInput,
  toApiProfileBackdrop,
} from './profile-backdrop';
import { isUniqueHandleError, normalizeProfileHandle } from './profile-handle';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvatarStorageService) private readonly avatarStorage: AvatarStorageService,
    @Optional() @Inject(ViewingsService) private readonly viewings?: ViewingsService,
  ) {}

  async getProfile(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);

    return this.getProfileByUserId(userId);
  }

  async getOwnPublicProfilePreview(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);

    return this.getPublicProfileByUserId(userId, false);
  }

  async listOwnOpinions(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);

    return this.listOpinionsForUser(userId);
  }

  async exportAccountData(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const account = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUniqueOrThrow({
        select: {
          authIdentities: {
            select: {
              createdAt: true,
              provider: true,
              providerUserId: true,
            },
          },
          avatarObjectKey: true,
          blockedUsers: {
            orderBy: { createdAt: 'desc' },
            select: {
              blockedUserId: true,
              createdAt: true,
            },
          },
          contentStates: {
            orderBy: { updatedAt: 'desc' },
            select: {
              contentType: true,
              favorite: true,
              status: true,
              tmdbId: true,
              updatedAt: true,
            },
          },
          createdAt: true,
          displayName: true,
          handle: true,
          episodeProgress: {
            orderBy: { watchedAt: 'desc' },
            select: {
              episodeNumber: true,
              seasonNumber: true,
              seriesTmdbId: true,
              watchedAt: true,
            },
          },
          episodeReviewLikes: {
            orderBy: { createdAt: 'desc' },
            select: {
              createdAt: true,
              reviewId: true,
            },
          },
          episodeRatings: {
            orderBy: { updatedAt: 'desc' },
            select: {
              episodeNumber: true,
              scoreHalfSteps: true,
              seasonNumber: true,
              seriesTmdbId: true,
              updatedAt: true,
            },
          },
          episodeReviews: {
            orderBy: { updatedAt: 'desc' },
            select: {
              body: true,
              episodeNumber: true,
              seasonNumber: true,
              seriesTmdbId: true,
              updatedAt: true,
            },
          },
          following: {
            orderBy: { createdAt: 'desc' },
            select: {
              createdAt: true,
              followedUserId: true,
            },
          },
          followers: {
            orderBy: { createdAt: 'desc' },
            select: {
              createdAt: true,
              followerId: true,
            },
          },
          id: true,
          movieRatings: {
            orderBy: { updatedAt: 'desc' },
            select: {
              scoreHalfSteps: true,
              tmdbId: true,
              updatedAt: true,
            },
          },
          movieReviews: {
            orderBy: { updatedAt: 'desc' },
            select: {
              body: true,
              tmdbId: true,
              updatedAt: true,
            },
          },
          movieReviewLikes: {
            orderBy: { createdAt: 'desc' },
            select: {
              createdAt: true,
              reviewId: true,
            },
          },
          notifications: {
            orderBy: { createdAt: 'desc' },
            select: {
              body: true,
              contentType: true,
              createdAt: true,
              episodeNumber: true,
              kind: true,
              readAt: true,
              releaseType: true,
              routeMetadata: true,
              seasonNumber: true,
              title: true,
              tmdbId: true,
            },
          },
          onboardingCompleted: true,
          profileBackdropContentType: true,
          profileBackdropTmdbId: true,
          ownedSharedWatchlists: {
            orderBy: { updatedAt: 'desc' },
            select: {
              createdAt: true,
              items: {
                orderBy: { createdAt: 'desc' },
                select: {
                  contentType: true,
                  createdAt: true,
                  tmdbId: true,
                },
              },
              name: true,
              updatedAt: true,
            },
          },
          personalWatchlists: {
            orderBy: { updatedAt: 'desc' },
            select: {
              createdAt: true,
              items: {
                orderBy: { createdAt: 'desc' },
                select: {
                  contentType: true,
                  createdAt: true,
                  tmdbId: true,
                },
              },
              name: true,
              updatedAt: true,
              visibility: true,
            },
          },
          privacySettings: {
            select: {
              episodeProgressVisibility: true,
              profileVisibility: true,
              ratingsVisibility: true,
              reviewsVisibility: true,
              sharedWatchlistVisibility: true,
              viewingHistoryVisibility: true,
            },
          },
          releaseAlertSubscriptions: {
            orderBy: { updatedAt: 'desc' },
            select: {
              contentType: true,
              tmdbId: true,
              updatedAt: true,
            },
          },
          sharedWatchlistMemberships: {
            orderBy: { createdAt: 'desc' },
            select: {
              createdAt: true,
              watchlistId: true,
            },
          },
          sharedVotingVotes: {
            orderBy: { createdAt: 'desc' },
            select: {
              candidateId: true,
              createdAt: true,
            },
          },
          updatedAt: true,
          viewingEvents: {
            orderBy: [{ watchedAt: 'desc' }, { createdAt: 'desc' }],
            select: {
              artworkUrl: true,
              contentType: true,
              createdAt: true,
              episodeNumber: true,
              genres: true,
              runtimeMinutes: true,
              seasonNumber: true,
              subtitle: true,
              title: true,
              tmdbId: true,
              watchedAt: true,
            },
          },
        },
        where: { id: userId },
      }),
    );

    return {
      account,
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
    };
  }

  async deleteAccount(identity: AuthenticatedIdentity) {
    const user = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUnique({
        select: {
          avatarObjectKey: true,
          id: true,
        },
        where: { firebaseUid: identity.firebaseUid },
      }),
    );

    if (user) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.$transaction([
          this.prisma.auditLog.deleteMany({
            where: {
              OR: [
                { actorUserId: user.id },
                { targetUserId: user.id },
              ],
            },
          }),
          this.prisma.user.delete({ where: { id: user.id } }),
        ]),
      );
      await this.avatarStorage.deleteObjectBestEffort(user.avatarObjectKey);
    }

    try {
      await getAuth().deleteUser(identity.firebaseUid);
    } catch (error) {
      if (!isFirebaseUserNotFound(error)) {
        throw new ServiceUnavailableException(
          'Watchly data was deleted, but sign-in removal needs another attempt.',
        );
      }
    }
  }

  async getPublicProfile(identity: AuthenticatedIdentity, targetUserId: string) {
    assertUuid(targetUserId);

    const viewerId = await this.getUserId(identity);

    return this.getPublicProfileByUserId(targetUserId, viewerId === targetUserId, viewerId);
  }

  async listProfileFollowers(identity: AuthenticatedIdentity, targetUserId: string) {
    return this.listProfileConnections(identity, targetUserId, 'followers');
  }

  async listProfileFollowing(identity: AuthenticatedIdentity, targetUserId: string) {
    return this.listProfileConnections(identity, targetUserId, 'following');
  }

  async searchProfiles(identity: AuthenticatedIdentity, value?: string) {
    const query = (value?.trim() ?? '').replace(/^@/, '');

    if (query.length < 2) {
      throw new BadRequestException('Profile search requires at least 2 characters.');
    }

    if (query.length > PROFILE_SEARCH_QUERY_MAX_LENGTH) {
      throw new BadRequestException(
        `Profile search must be ${PROFILE_SEARCH_QUERY_MAX_LENGTH} characters or fewer.`,
      );
    }

    const viewerId = await this.getUserId(identity);
    const users = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findMany({
        orderBy: {
          displayName: 'asc',
        },
        select: {
          avatarObjectKey: true,
          displayName: true,
          handle: true,
          id: true,
        },
        take: PROFILE_SEARCH_LIMIT,
        where: {
          AND: [activeAccountWhere()],
          blockedUsers: {
            none: {
              blockedUserId: viewerId,
            },
          },
          handle: { not: null },
          onboardingCompleted: true,
          OR: [
            {
              displayName: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              handle: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        },
      }),
    );

    return {
      items: users.map((user) => ({
        avatarUrl: this.avatarStorage.getPublicUrl(user.avatarObjectKey),
        displayName: user.displayName ?? 'Watchly member',
        handle: user.handle,
        id: user.id,
      })),
    };
  }

  async getHandleAvailability(identity: AuthenticatedIdentity, value: string) {
    const handle = normalizeProfileHandle(value);
    const viewerId = await this.getUserId(identity);
    const existing = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUnique({
        select: {
          id: true,
        },
        where: {
          handle,
        },
      }),
    );

    return {
      available: !existing || existing.id === viewerId,
      handle,
    };
  }

  async getOrCreateDevTestUser(identity: AuthenticatedIdentity) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev test profile is disabled.');
    }

    const viewerId = await this.getUserId(identity);

    const identityKey = {
      provider: AuthProvider.GOOGLE,
      providerUserId: '__dev_block_test_profile__',
    };
    const existingIdentity = await this.prisma.withConnectionRetry(
      () =>
        this.prisma.authIdentity.findUnique({
          include: {
            user: {
              include: {
                privacySettings: true,
              },
            },
          },
          where: {
            provider_providerUserId: identityKey,
          },
        }),
    );

    if (existingIdentity) {
      await this.ensurePublicTestProfile(existingIdentity.user.id, viewerId);

      return this.getPublicProfileByUserId(existingIdentity.user.id, true);
    }

    const user = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.create({
      data: {
        authIdentities: {
          create: identityKey,
        },
        displayName: 'Test profile',
        firebaseUid: identityKey.providerUserId,
        handle: 'watchly_test',
        privacySettings: {
          create: {
            profileVisibility: PrivacyVisibility.PUBLIC,
            reviewsVisibility: PrivacyVisibility.PUBLIC,
          },
        },
      },
      }),
    );

    await this.ensurePublicTestProfile(user.id, viewerId);

    return this.getPublicProfileByUserId(user.id, true);
  }

  async updateProfile(identity: AuthenticatedIdentity, input: UpdateProfileDto) {
    if (!hasOwn(input, 'displayName')) {
      throw new BadRequestException('displayName is required.');
    }

    const userId = await this.getUserId(identity);
    const displayName = normalizeDisplayName(input.displayName);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.user.update({
      data: {
        displayName,
      },
      where: {
        id: userId,
      },
      }),
    );

    return this.getProfileByUserId(userId);
  }

  async createAvatarUpload(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);

    return this.avatarStorage.createUpload(userId);
  }

  async confirmAvatarUpload(identity: AuthenticatedIdentity, objectKey: string) {
    const userId = await this.getUserId(identity);
    await this.avatarStorage.verifyUpload(userId, objectKey);
    const current = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUniqueOrThrow({
        select: { avatarObjectKey: true },
        where: { id: userId },
      }),
    );

    try {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.user.update({
          data: { avatarObjectKey: objectKey },
          where: { id: userId },
        }),
      );
    } catch (error) {
      await this.avatarStorage.deleteObjectBestEffort(objectKey);
      throw error;
    }

    if (current.avatarObjectKey !== objectKey) {
      await this.avatarStorage.deleteObjectBestEffort(current.avatarObjectKey);
    }

    return this.getProfileByUserId(userId);
  }

  async removeAvatar(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const current = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUniqueOrThrow({
        select: { avatarObjectKey: true },
        where: { id: userId },
      }),
    );

    await this.prisma.withConnectionRetry(() =>
      this.prisma.user.update({
        data: {
          avatarObjectKey: null,
          providerAvatarImportDisabled: true,
        },
        where: { id: userId },
      }),
    );
    await this.avatarStorage.deleteObjectBestEffort(current.avatarObjectKey);

    return this.getProfileByUserId(userId);
  }

  async updateProfileBackdrop(
    identity: AuthenticatedIdentity,
    input: UpdateProfileBackdropDto,
  ) {
    const selection = normalizeProfileBackdropInput(input);
    const userId = await this.getUserId(identity);

    if (selection) {
      const [contentState, releaseAlert, episodeProgressCount] =
        await this.prisma.withConnectionRetry(() => Promise.all([
          this.prisma.userContentState.findUnique({
            select: { favorite: true, status: true },
            where: {
              userId_contentType_tmdbId: {
                contentType: selection.contentType,
                tmdbId: selection.tmdbId,
                userId,
              },
            },
          }),
          this.prisma.releaseAlertSubscription.findUnique({
            select: { id: true },
            where: {
              userId_contentType_tmdbId: {
                contentType: selection.contentType,
                tmdbId: selection.tmdbId,
                userId,
              },
            },
          }),
          this.prisma.userEpisodeProgress.count({
            where: {
              seriesTmdbId: selection.tmdbId,
              userId,
            },
          }),
        ]));

      if (!isProfileBackdropEligible({
        favorite: contentState?.favorite ?? false,
        hasEpisodeProgress: episodeProgressCount > 0,
        hasReleaseAlert: Boolean(releaseAlert),
        selection,
        status: contentState?.status ?? null,
      })) {
        throw new BadRequestException('Choose a movie or series from your profile.');
      }
    }

    await this.prisma.withConnectionRetry(() =>
      this.prisma.user.update({
        data: {
          profileBackdropContentType: selection?.contentType ?? null,
          profileBackdropTmdbId: selection?.tmdbId ?? null,
        },
        where: { id: userId },
      }),
    );

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

    await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (tx) => {
      await tx.privacySettings.upsert({
        create: {
          episodeProgressVisibility: profileVisibility ?? (input.episodeProgressVisibility
            ? toPrivacyVisibility(input.episodeProgressVisibility)
            : undefined),
          profileVisibility,
          ratingsVisibility: profileVisibility ?? (input.ratingsVisibility
            ? toPrivacyVisibility(input.ratingsVisibility)
            : undefined),
          reviewsVisibility: profileVisibility,
          sharedWatchlistVisibility: input.sharedWatchlistVisibility
            ? toSharedWatchlistVisibility(input.sharedWatchlistVisibility)
            : undefined,
          userId,
          viewingHistoryVisibility: profileVisibility ?? (input.viewingHistoryVisibility
            ? toPrivacyVisibility(input.viewingHistoryVisibility)
            : undefined),
        },
        update: {
          ...(input.episodeProgressVisibility
            ? { episodeProgressVisibility: toPrivacyVisibility(input.episodeProgressVisibility) }
            : {}),
          ...(profileVisibility
            ? {
                episodeProgressVisibility: profileVisibility,
                profileVisibility,
                ratingsVisibility: profileVisibility,
                reviewsVisibility: profileVisibility,
                viewingHistoryVisibility: profileVisibility,
              }
            : {}),
          ...(!profileVisibility && input.ratingsVisibility
            ? { ratingsVisibility: toPrivacyVisibility(input.ratingsVisibility) }
            : {}),
          ...(input.sharedWatchlistVisibility
            ? {
                sharedWatchlistVisibility: toSharedWatchlistVisibility(
                  input.sharedWatchlistVisibility,
                ),
              }
            : {}),
          ...(!profileVisibility && input.viewingHistoryVisibility
            ? { viewingHistoryVisibility: toPrivacyVisibility(input.viewingHistoryVisibility) }
            : {}),
        },
        where: {
          userId,
        },
      });

      if (profileVisibility === PrivacyVisibility.PUBLIC) {
        await tx.userFollow.updateMany({
          data: {
            status: FollowStatus.ACCEPTED,
          },
          where: {
            followedUserId: userId,
            status: FollowStatus.PENDING,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: AuditAction.PRIVACY_UPDATED,
          actorUserId: userId,
          metadata: {
            changedFields: getPrivacyAuditFields(input),
          },
        },
      });
      }),
    );

    return this.getProfileByUserId(userId);
  }

  async completeOnboarding(
    identity: AuthenticatedIdentity,
    value: CompleteOnboardingDto | string,
  ) {
    const input: CompleteOnboardingDto = typeof value === 'string' ? { handle: value } : value;
    const handle = normalizeProfileHandle(input.handle);
    const displayName = normalizeOnboardingDisplayName(input.displayName);
    const tasteItems = dedupeTasteItems(input.tasteItems ?? []);
    const completedImportIds = input.completedImportIds ?? [];
    const userId = await this.getUserId(identity);
    let user;

    try {
      user = await this.prisma.withConnectionRetry(() =>
        this.prisma.$transaction(async (tx) => {
          const current = await tx.user.findUniqueOrThrow({
            select: {
              displayName: true,
              handle: true,
              onboardingCompleted: true,
            },
            where: {
              id: userId,
            },
          });

          if (current.handle && current.handle !== handle) {
            throw new BadRequestException('Your handle cannot be changed.');
          }

          if (!current.onboardingCompleted) {
            if (!(displayName ?? current.displayName)?.trim()) {
              throw new BadRequestException('Enter your display name to continue.');
            }

            const completedImports = completedImportIds.length > 0
              ? await tx.dataImport.findMany({
                select: { id: true, preview: true },
                where: {
                  id: { in: completedImportIds },
                  status: DataImportStatus.COMPLETED,
                  userId,
                },
              })
              : [];

            if (completedImports.length !== completedImportIds.length) {
              throw new BadRequestException('A completed import does not belong to this account.');
            }

            const importAddedTitles = completedImports.some((item) =>
              getCompletedImportTitleCount(item.preview) > 0
            );

            const tasteMovieCount = tasteItems.filter((item) => item.contentType === 'movie').length;
            const tasteSeriesCount = tasteItems.length - tasteMovieCount;

            if (
              !importAddedTitles
              && (
                tasteItems.length < 1
                || tasteItems.length > 10
                || tasteMovieCount > 5
                || tasteSeriesCount > 5
              )
            ) {
              throw new BadRequestException(
                'Choose up to 5 movies and 5 TV shows, or complete an import.',
              );
            }

            for (const item of tasteItems) {
              await tx.userContentState.upsert({
                create: {
                  contentType: item.contentType === 'movie'
                    ? TrackedContentType.MOVIE
                    : TrackedContentType.SERIES,
                  status: UserContentStatus.WATCHED,
                  tmdbId: item.tmdbId,
                  userId,
                },
                update: { status: UserContentStatus.WATCHED },
                where: {
                  userId_contentType_tmdbId: {
                    contentType: item.contentType === 'movie'
                      ? TrackedContentType.MOVIE
                      : TrackedContentType.SERIES,
                    tmdbId: item.tmdbId,
                    userId,
                  },
                },
              });
            }
          }

          if (!current.handle) {
            const claim = await tx.user.updateMany({
              data: {
                handle,
              },
              where: {
                handle: null,
                id: userId,
              },
            });

            if (claim.count === 0) {
              const claimedUser = await tx.user.findUniqueOrThrow({
                select: {
                  handle: true,
                },
                where: {
                  id: userId,
                },
              });

              if (claimedUser.handle !== handle) {
                throw new BadRequestException('Your handle cannot be changed.');
              }
            }
          }

          return tx.user.update({
            data: {
              ...(displayName !== undefined ? { displayName } : {}),
              onboardingCompleted: true,
            },
            where: {
              id: userId,
            },
          });
        }),
      );
    } catch (error) {
      if (isUniqueHandleError(error)) {
        throw new ConflictException('This handle is already taken.');
      }

      throw error;
    }

    return {
      displayName: user.displayName,
      handle: user.handle,
      id: user.id,
      onboardingCompleted: user.onboardingCompleted,
    };
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async listProfileConnections(
    identity: AuthenticatedIdentity,
    targetUserId: string,
    kind: 'followers' | 'following',
  ) {
    const viewerId = await this.getUserId(identity);

    assertUuid(targetUserId);

    const target = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUnique({
        select: {
          id: true,
          privacySettings: {
            select: {
              profileVisibility: true,
            },
          },
        },
        where: { AND: [activeAccountWhere()], id: targetUserId },
      }),
    );

    if (!target) {
      throw new NotFoundException('Profile not found.');
    }

    if (viewerId !== targetUserId) {
      const blockRelationship = await this.getProfileBlockRelationship(viewerId, targetUserId);

      if (blockRelationship) {
        throw new ForbiddenException('This profile is unavailable.');
      }

      if (target.privacySettings?.profileVisibility === PrivacyVisibility.PRIVATE) {
        const acceptedFollow = await this.prisma.withConnectionRetry(() =>
          this.prisma.userFollow.findFirst({
            select: { id: true },
            where: {
              followedUserId: targetUserId,
              followerId: viewerId,
              status: FollowStatus.ACCEPTED,
            },
          }),
        );

        if (!acceptedFollow) {
          throw new ForbiddenException('Follow this private profile to view its connections.');
        }
      }
    }

    const users = kind === 'followers'
      ? (await this.prisma.withConnectionRetry(() =>
          this.prisma.userFollow.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
              follower: {
                select: {
                  avatarObjectKey: true,
                  displayName: true,
                  handle: true,
                  id: true,
                },
              },
            },
            where: {
              followedUserId: targetUserId,
              follower: {
                blockedUsers: { none: { blockedUserId: viewerId } },
                handle: { not: null },
                onboardingCompleted: true,
                AND: [activeAccountWhere()],
              },
              status: FollowStatus.ACCEPTED,
            },
          }),
        )).map((connection) => connection.follower)
      : (await this.prisma.withConnectionRetry(() =>
          this.prisma.userFollow.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
              followedUser: {
                select: {
                  avatarObjectKey: true,
                  displayName: true,
                  handle: true,
                  id: true,
                },
              },
            },
            where: {
              followedUser: {
                blockedUsers: { none: { blockedUserId: viewerId } },
                handle: { not: null },
                onboardingCompleted: true,
                AND: [activeAccountWhere()],
              },
              followerId: targetUserId,
              status: FollowStatus.ACCEPTED,
            },
          }),
        )).map((connection) => connection.followedUser);

    return {
      items: users.map((user) => ({
        avatarUrl: this.avatarStorage.getPublicUrl(user.avatarObjectKey),
        displayName: user.displayName?.trim() || user.handle,
        handle: user.handle,
        id: user.id,
      })),
    };
  }

  private async getProfileByUserId(userId: string) {
    const { privacySettings, user } = await this.prisma.withConnectionRetry(async () => {
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

      return { privacySettings, user };
    });

    return {
      avatarUploadsEnabled: this.avatarStorage.uploadsEnabled,
      avatarUrl: this.avatarStorage.getPublicUrl(user.avatarObjectKey),
      displayName: user.displayName,
      handle: user.handle,
      id: user.id,
      providerAvatarImportEnabled: !user.providerAvatarImportDisabled,
      profileBackdrop: toApiProfileBackdrop(
        user.profileBackdropContentType,
        user.profileBackdropTmdbId,
      ),
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

  private async getPublicProfileByUserId(
    userId: string,
    allowOwnerPrivateView: boolean,
    viewerId?: string,
  ) {
    const user = await this.prisma.withConnectionRetry(
      () =>
        this.prisma.user.findUnique({
          include: {
            personalWatchlists: {
              orderBy: {
                updatedAt: 'desc',
              },
              select: {
                _count: {
                  select: {
                    items: true,
                  },
                },
                id: true,
                name: true,
                updatedAt: true,
              },
              where: {
                visibility: PrivacyVisibility.PUBLIC,
              },
            },
            privacySettings: true,
          },
          where: {
            AND: [activeAccountWhere()],
            id: userId,
          },
        }),
    );

    if (!user) {
      throw new NotFoundException('Profile not found.');
    }

    const blockRelationship = !allowOwnerPrivateView && viewerId
      ? await this.getProfileBlockRelationship(viewerId, userId)
      : null;
    const isBlockedProfile = blockRelationship !== null;

    const profileIsPrivate =
      user.privacySettings?.profileVisibility === PrivacyVisibility.PRIVATE;
    const acceptedFollow = profileIsPrivate && !allowOwnerPrivateView && viewerId && !isBlockedProfile
      ? await this.prisma.withConnectionRetry(() =>
          this.prisma.userFollow.findFirst({
            select: {
              id: true,
            },
            where: {
              followedUserId: userId,
              followerId: viewerId,
              status: FollowStatus.ACCEPTED,
            },
          }),
        )
      : null;
    const canViewContent = !isBlockedProfile
      && (!profileIsPrivate || allowOwnerPrivateView || Boolean(acceptedFollow));
    const profileContent = canViewContent
      ? await Promise.all([
          this.listOpinionsForUser(user.id),
          this.getPublicProfileMedia(user.id),
          this.viewings?.getStatsForUser(user.id) ?? Promise.resolve(EMPTY_VIEWING_STATS),
        ] as const)
      : null;
    const [opinions, media, viewingStats] = profileContent ?? [];
    const socialStats = canViewContent
      ? opinions?.stats
      : await this.getProfileSocialStats(user.id);

    return {
      avatarUrl: this.avatarStorage.getPublicUrl(user.avatarObjectKey),
      blockRelationship,
      canViewContent,
      displayName: user.displayName,
      handle: user.handle,
      id: user.id,
      media: media ?? {
        movieRatings: [],
        releaseAlerts: [],
        seriesProgress: [],
        trackingStates: [],
      },
      opinions: opinions?.items ?? [],
      profileBackdrop: canViewContent || isBlockedProfile
        ? toApiProfileBackdrop(
            user.profileBackdropContentType,
            user.profileBackdropTmdbId,
          )
        : null,
      profileVisibility: fromPrivacyVisibility(
        user.privacySettings?.profileVisibility ?? PrivacyVisibility.PUBLIC,
      ),
      stats: {
        followersCount: socialStats?.followersCount ?? 0,
        followingCount: socialStats?.followingCount ?? 0,
        postsCount: canViewContent || isBlockedProfile ? socialStats?.postsCount ?? 0 : 0,
        reviewsCount: canViewContent || isBlockedProfile ? socialStats?.reviewsCount ?? 0 : 0,
      },
      viewingStats: viewingStats ?? null,
      watchlists: canViewContent
        ? user.personalWatchlists.map((watchlist) => ({
            id: watchlist.id,
            itemCount: watchlist._count.items,
            name: watchlist.name,
            updatedAt: watchlist.updatedAt.toISOString(),
          }))
        : [],
    };
  }

  private async listOpinionsForUser(userId: string) {
    const [[movieRatings, episodeRatings, movieReviews, episodeReviews], stats] =
      await Promise.all([
        this.prisma.withConnectionRetry(() => Promise.all([
          this.prisma.userMovieRating.findMany({
            orderBy: { updatedAt: 'desc' },
            take: PROFILE_OPINION_LIMIT,
            where: { userId },
          }),
          this.prisma.userEpisodeRating.findMany({
            orderBy: { updatedAt: 'desc' },
            take: PROFILE_OPINION_LIMIT,
            where: { userId },
          }),
          this.prisma.userMovieReview.findMany({
            orderBy: { updatedAt: 'desc' },
            take: PROFILE_OPINION_LIMIT,
            where: { moderationHiddenAt: null, userId },
          }),
          this.prisma.userEpisodeReview.findMany({
            orderBy: { updatedAt: 'desc' },
            take: PROFILE_OPINION_LIMIT,
            where: { moderationHiddenAt: null, userId },
          }),
        ] as const)),
        this.getProfileStats(userId),
      ] as const);
    const movieReviewTmdbIds = new Set(movieReviews.map((review) => review.tmdbId));
    const episodeReviewKeys = new Set(episodeReviews.map(getEpisodeOpinionKey));
    const movieRatingByTmdbId = new Map(
      movieRatings.map((rating) => [rating.tmdbId, rating.scoreHalfSteps / 2]),
    );
    const episodeRatingByKey = new Map(
      episodeRatings.map((rating) => [getEpisodeOpinionKey(rating), rating.scoreHalfSteps / 2]),
    );
    const items = [
      ...movieRatings
        .filter((rating) => !movieReviewTmdbIds.has(rating.tmdbId))
        .map(toMovieRatingOpinion),
      ...episodeRatings
        .filter((rating) => !episodeReviewKeys.has(getEpisodeOpinionKey(rating)))
        .map(toEpisodeRatingOpinion),
      ...movieReviews.map((review) =>
        toMovieReviewOpinion(review, movieRatingByTmdbId.get(review.tmdbId) ?? null),
      ),
      ...episodeReviews.map((review) =>
        toEpisodeReviewOpinion(review, episodeRatingByKey.get(getEpisodeOpinionKey(review)) ?? null),
      ),
    ]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, PROFILE_OPINION_LIMIT);

    return { items, stats };
  }

  private async getPublicProfileMedia(userId: string) {
    const [trackingStates, movieRatings, progress, releaseAlerts] =
      await this.prisma.withConnectionRetry(() => Promise.all([
        this.prisma.userContentState.findMany({
          orderBy: { updatedAt: 'desc' },
          select: {
            contentType: true,
            favorite: true,
            id: true,
            status: true,
            tmdbId: true,
            updatedAt: true,
          },
          where: { userId },
        }),
        this.prisma.userMovieRating.findMany({
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            scoreHalfSteps: true,
            tmdbId: true,
            updatedAt: true,
          },
          where: { userId },
        }),
        this.prisma.userEpisodeProgress.findMany({
          orderBy: [
            { seriesTmdbId: 'asc' },
            { seasonNumber: 'asc' },
            { episodeNumber: 'asc' },
          ],
          select: {
            episodeNumber: true,
            seasonNumber: true,
            seriesTmdbId: true,
            updatedAt: true,
          },
          where: { userId },
        }),
        this.prisma.releaseAlertSubscription.findMany({
          orderBy: { updatedAt: 'desc' },
          select: {
            contentType: true,
            tmdbId: true,
            updatedAt: true,
          },
          where: { userId },
        }),
      ] as const));
    const progressBySeries = new Map<number, PublicSeriesProgressAccumulator>();

    progress.forEach((episode) => {
      const existing = progressBySeries.get(episode.seriesTmdbId);

      if (!existing) {
        progressBySeries.set(episode.seriesTmdbId, {
          latestEpisodeNumber: episode.episodeNumber,
          latestSeasonNumber: episode.seasonNumber,
          seriesTmdbId: episode.seriesTmdbId,
          updatedAt: episode.updatedAt,
          watchedEpisodeCount: 1,
        });
        return;
      }

      existing.watchedEpisodeCount += 1;

      if (
        episode.seasonNumber > existing.latestSeasonNumber
        || (
          episode.seasonNumber === existing.latestSeasonNumber
          && episode.episodeNumber > existing.latestEpisodeNumber
        )
      ) {
        existing.latestEpisodeNumber = episode.episodeNumber;
        existing.latestSeasonNumber = episode.seasonNumber;
      }

      if (episode.updatedAt > existing.updatedAt) {
        existing.updatedAt = episode.updatedAt;
      }
    });

    return {
      movieRatings: movieRatings.map((rating) => ({
        id: rating.id,
        score: rating.scoreHalfSteps / 2,
        tmdbId: rating.tmdbId,
        updatedAt: rating.updatedAt.toISOString(),
      })),
      releaseAlerts: releaseAlerts.map((alert) => ({
        contentType: fromTrackedContentType(alert.contentType),
        tmdbId: alert.tmdbId,
        updatedAt: alert.updatedAt.toISOString(),
      })),
      seriesProgress: Array.from(progressBySeries.values())
        .map((summary) => ({
          ...summary,
          updatedAt: summary.updatedAt.toISOString(),
        }))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      trackingStates: trackingStates.map((state) => ({
        contentType: fromTrackedContentType(state.contentType),
        favorite: state.favorite,
        id: state.id,
        status: fromUserContentStatus(state.status),
        tmdbId: state.tmdbId,
        updatedAt: state.updatedAt.toISOString(),
      })),
    };
  }

  private async getProfileStats(userId: string) {
    const stats = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUniqueOrThrow({
        select: {
          _count: {
            select: {
              episodeRatings: true,
              episodeReviews: { where: { moderationHiddenAt: null } },
              followers: {
                where: {
                  follower: { AND: [activeAccountWhere()] },
                  status: FollowStatus.ACCEPTED,
                },
              },
              following: {
                where: {
                  followedUser: { AND: [activeAccountWhere()] },
                  status: FollowStatus.ACCEPTED,
                },
              },
              movieRatings: true,
              movieReviews: { where: { moderationHiddenAt: null } },
            },
          },
        },
        where: { id: userId },
      }),
    );

    return {
      followersCount: stats._count.followers,
      followingCount: stats._count.following,
      postsCount: stats._count.movieRatings + stats._count.episodeRatings,
      reviewsCount: stats._count.movieReviews + stats._count.episodeReviews,
    };
  }

  private async getProfileSocialStats(userId: string) {
    const stats = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUniqueOrThrow({
        select: {
          _count: {
            select: {
              followers: {
                where: {
                  follower: { AND: [activeAccountWhere()] },
                  status: FollowStatus.ACCEPTED,
                },
              },
              following: {
                where: {
                  followedUser: { AND: [activeAccountWhere()] },
                  status: FollowStatus.ACCEPTED,
                },
              },
            },
          },
        },
        where: { id: userId },
      }),
    );

    return {
      followersCount: stats._count.followers,
      followingCount: stats._count.following,
      postsCount: 0,
      reviewsCount: 0,
    };
  }

  private async ensurePublicTestProfile(userId: string, viewerId: string) {
    await this.prisma.withConnectionRetry(
      () =>
        this.prisma.user.update({
          data: {
            displayName: 'Test profile',
            handle: 'watchly_test',
            onboardingCompleted: true,
            privacySettings: {
              upsert: {
                create: {
                  profileVisibility: PrivacyVisibility.PUBLIC,
                  reviewsVisibility: PrivacyVisibility.PUBLIC,
                },
                update: {
                  profileVisibility: PrivacyVisibility.PUBLIC,
                  reviewsVisibility: PrivacyVisibility.PUBLIC,
                },
              },
            },
          },
          where: {
            id: userId,
          },
        }),
    );

    await this.prisma.withConnectionRetry(
      () =>
        this.prisma.userBlock.deleteMany({
          where: {
            OR: [
              {
                blockedUserId: userId,
                blockerId: viewerId,
              },
              {
                blockedUserId: viewerId,
                blockerId: userId,
              },
            ],
          },
        }),
    );

    await this.prisma.withConnectionRetry(
      () =>
        this.prisma.$transaction(async (tx) => {
          await tx.userMovieRating.upsert({
            create: {
              scoreHalfSteps: 8,
              tmdbId: DEV_TEST_REVIEW_TMDB_ID,
              userId,
            },
            update: {
              scoreHalfSteps: 8,
            },
            where: {
              userId_tmdbId: {
                tmdbId: DEV_TEST_REVIEW_TMDB_ID,
                userId,
              },
            },
          });
          await tx.userMovieReview.upsert({
            create: {
              body: DEV_TEST_REVIEW_BODY,
              tmdbId: DEV_TEST_REVIEW_TMDB_ID,
              userId,
            },
            update: {
              body: DEV_TEST_REVIEW_BODY,
            },
            where: {
              userId_tmdbId: {
                tmdbId: DEV_TEST_REVIEW_TMDB_ID,
                userId,
              },
            },
          });
        }),
    );
  }

  private async getProfileBlockRelationship(viewerId: string, targetUserId: string) {
    const blocks = await this.prisma.withConnectionRetry(() =>
      this.prisma.userBlock.findMany({
        select: {
          blockerId: true,
        },
        where: {
          OR: [
            {
              blockedUserId: targetUserId,
              blockerId: viewerId,
            },
            {
              blockedUserId: viewerId,
              blockerId: targetUserId,
            },
          ],
        },
      }),
    );

    if (blocks.length === 0) return null;

    return blocks.some((block) => block.blockerId === viewerId)
      ? 'blocked_by_viewer'
      : 'blocked_by_profile';
  }
}

function normalizeOnboardingDisplayName(value: string | null | undefined) {
  if (value === undefined) return undefined;

  const displayName = value?.trim() ?? '';
  return displayName.length > 0 ? displayName : null;
}

function dedupeTasteItems(items: CompleteOnboardingDto['tasteItems']) {
  const unique = new Map<string, NonNullable<CompleteOnboardingDto['tasteItems']>[number]>();

  (items ?? []).forEach((item) => {
    unique.set(`${item.contentType}:${item.tmdbId}`, item);
  });

  return [...unique.values()];
}

function getCompletedImportTitleCount(value: unknown) {
  if (!value || typeof value !== 'object' || !('result' in value)) return 0;

  const result = value.result;
  if (!result || typeof result !== 'object' || !('titlesProcessed' in result)) return 0;

  return typeof result.titlesProcessed === 'number' && result.titlesProcessed > 0
    ? result.titlesProcessed
    : 0;
}

const PROFILE_SEARCH_LIMIT = 20;
const PROFILE_SEARCH_QUERY_MAX_LENGTH = 80;

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

function fromTrackedContentType(contentType: TrackedContentType) {
  return contentType === TrackedContentType.MOVIE ? 'movie' as const : 'series' as const;
}

function fromUserContentStatus(status: UserContentStatus | null) {
  switch (status) {
    case UserContentStatus.WATCHLISTED:
      return 'watchlisted' as const;
    case UserContentStatus.WATCHING:
      return 'watching' as const;
    case UserContentStatus.WATCHED:
      return 'watched' as const;
    case UserContentStatus.DROPPED:
      return 'dropped' as const;
    default:
      return null;
  }
}

type PublicSeriesProgressAccumulator = {
  latestEpisodeNumber: number;
  latestSeasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
  watchedEpisodeCount: number;
};

type MovieRatingOpinionRecord = {
  id: string;
  scoreHalfSteps: number;
  tmdbId: number;
  updatedAt: Date;
};

type EpisodeRatingOpinionRecord = {
  episodeNumber: number;
  id: string;
  scoreHalfSteps: number;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
};

type MovieReviewOpinionRecord = {
  body: string;
  id: string;
  tmdbId: number;
  updatedAt: Date;
};

type EpisodeReviewOpinionRecord = {
  body: string;
  episodeNumber: number;
  id: string;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
};

function toMovieRatingOpinion(rating: MovieRatingOpinionRecord) {
  return {
    content: {
      contentType: 'movie' as const,
      tmdbId: rating.tmdbId,
    },
    id: rating.id,
    score: rating.scoreHalfSteps / 2,
    type: 'movieRating' as const,
    updatedAt: rating.updatedAt.toISOString(),
  };
}

function toEpisodeRatingOpinion(rating: EpisodeRatingOpinionRecord) {
  return {
    content: {
      contentType: 'episode' as const,
      episodeNumber: rating.episodeNumber,
      seasonNumber: rating.seasonNumber,
      seriesTmdbId: rating.seriesTmdbId,
    },
    id: rating.id,
    score: rating.scoreHalfSteps / 2,
    type: 'episodeRating' as const,
    updatedAt: rating.updatedAt.toISOString(),
  };
}

function toMovieReviewOpinion(review: MovieReviewOpinionRecord, score: number | null) {
  return {
    body: review.body,
    content: {
      contentType: 'movie' as const,
      tmdbId: review.tmdbId,
    },
    id: review.id,
    score,
    type: 'movieReview' as const,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toEpisodeReviewOpinion(review: EpisodeReviewOpinionRecord, score: number | null) {
  return {
    body: review.body,
    content: {
      contentType: 'episode' as const,
      episodeNumber: review.episodeNumber,
      seasonNumber: review.seasonNumber,
      seriesTmdbId: review.seriesTmdbId,
    },
    id: review.id,
    score,
    type: 'episodeReview' as const,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function getEpisodeOpinionKey(
  item: Pick<EpisodeRatingOpinionRecord | EpisodeReviewOpinionRecord, 'episodeNumber' | 'seasonNumber' | 'seriesTmdbId'>,
) {
  return `${item.seriesTmdbId}:${item.seasonNumber}:${item.episodeNumber}`;
}

function getPrivacyAuditFields(input: UpdatePrivacySettingsDto) {
  const fields = Object.keys(input);

  if (hasOwn(input, 'profileVisibility')) {
    fields.push(
      'episodeProgressVisibility',
      'ratingsVisibility',
      'reviewsVisibility',
      'viewingHistoryVisibility',
    );
  }

  return Array.from(new Set(fields)).sort();
}

function isFirebaseUserNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'auth/user-not-found'
  );
}

const DEV_TEST_REVIEW_TMDB_ID = 603;
const DEV_TEST_REVIEW_BODY =
  'Dev feed test review. This public written review should appear in Feed.';
const PROFILE_OPINION_LIMIT = 50;
const EMPTY_VIEWING_STATS = {
  highlights: [],
  more: {
    averageRating: null,
    favoriteWatchDay: null,
    mostUsedRating: null,
    ratingCount: 0,
    rewatchCount: 0,
  },
  summary: {
    episodeCount: 0,
    movieCount: 0,
    seriesCount: 0,
    totalViewCount: 0,
    watchMinutes: 0,
    watchTimeIsEstimated: false,
  },
  taste: [],
};
