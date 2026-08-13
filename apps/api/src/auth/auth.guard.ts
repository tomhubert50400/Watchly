import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedRequest } from './auth.types';
import { AuthService } from './auth.service';
import { FirebaseTokenVerifier } from './firebase-token-verifier.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(FirebaseTokenVerifier) private readonly tokenVerifier: FirebaseTokenVerifier,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    request.authIdentity = await this.tokenVerifier.verifyBearerToken(token);
    await this.authService.assertActiveIdentity(request.authIdentity);

    return true;
  }
}

export function extractBearerToken(authorization: string | string[] | undefined): string {
  if (typeof authorization !== 'string') {
    throw new UnauthorizedException('Missing auth token.');
  }

  const parts = authorization.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return parts[1];
}
