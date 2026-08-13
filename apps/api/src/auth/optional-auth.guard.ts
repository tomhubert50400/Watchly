import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthenticatedRequest } from './auth.types';
import { extractBearerToken } from './auth.guard';
import { AuthService } from './auth.service';
import { FirebaseTokenVerifier } from './firebase-token-verifier.service';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    @Inject(FirebaseTokenVerifier) private readonly tokenVerifier: FirebaseTokenVerifier,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.headers.authorization === undefined) {
      request.authIdentity = undefined;
      return true;
    }

    request.authIdentity = await this.tokenVerifier.verifyBearerToken(
      extractBearerToken(request.headers.authorization),
    );
    await this.authService.assertActiveIdentity(request.authIdentity);

    return true;
  }
}
