import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthenticatedRequest } from './auth.types';
import { extractBearerToken } from './auth.guard';
import { FirebaseTokenVerifier } from './firebase-token-verifier.service';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(@Inject(FirebaseTokenVerifier) private readonly tokenVerifier: FirebaseTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.headers.authorization === undefined) {
      request.authIdentity = undefined;
      return true;
    }

    request.authIdentity = await this.tokenVerifier.verifyBearerToken(
      extractBearerToken(request.headers.authorization),
    );

    return true;
  }
}
