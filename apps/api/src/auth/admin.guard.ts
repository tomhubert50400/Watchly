import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AdminRequest } from './auth.types';
import { extractBearerToken } from './auth.guard';
import { FirebaseTokenVerifier } from './firebase-token-verifier.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(FirebaseTokenVerifier) private readonly tokenVerifier: FirebaseTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const token = extractBearerToken(request.headers.authorization);

    request.adminIdentity = await this.tokenVerifier.verifyAdminBearerToken(token);

    return true;
  }
}
