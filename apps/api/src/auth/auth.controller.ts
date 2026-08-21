import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';
import { ExternalOAuthService } from './external-oauth.service';
import { parseExternalOAuthProvider } from './external-oauth.provider';
import { OptionalAuthGuard } from './optional-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ExternalOAuthService) private readonly externalOAuth: ExternalOAuthService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    if (!request.authIdentity) {
      throw new UnauthorizedException('Missing auth token.');
    }

    return this.authService.getOrCreateUser(request.authIdentity);
  }

  @Post('oauth/:provider/start')
  @HttpCode(200)
  @UseGuards(OptionalAuthGuard)
  startExternalOAuth(
    @Param('provider') providerValue: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.externalOAuth.start(
      requireExternalProvider(providerValue),
      request.authIdentity?.firebaseUid,
    );
  }

  @Get('oauth/:provider/callback')
  async completeExternalOAuth(
    @Param('provider') providerValue: string,
    @Query('code') code: string | undefined,
    @Query('error') providerError: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: { redirect(status: number, url: string): void },
  ) {
    const redirectUri = await this.externalOAuth.completeAuthorization(
      requireExternalProvider(providerValue),
      state,
      code,
      providerError,
    );

    response.redirect(302, redirectUri);
  }

  @Post('oauth/exchange')
  @HttpCode(200)
  exchangeExternalOAuth(@Body() body: Record<string, unknown>) {
    return this.externalOAuth.exchange(requireTicket(body));
  }

  @Post('oauth/microsoft/token')
  @HttpCode(200)
  @UseGuards(OptionalAuthGuard)
  createMicrosoftOAuthTicket(
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.externalOAuth.completeMicrosoftToken(
      requireMicrosoftIdToken(body),
      request.authIdentity?.firebaseUid,
    );
  }

  @Post('oauth/discord/mobile')
  @HttpCode(200)
  @UseGuards(OptionalAuthGuard)
  createDiscordMobileOAuthTicket(
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    const authorization = requireDiscordMobileAuthorization(body);

    return this.externalOAuth.completeDiscordMobileAuthorization(
      authorization.code,
      authorization.redirectUri,
      authorization.codeVerifier,
      request.authIdentity?.firebaseUid,
    );
  }

  @Post('oauth/link')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async linkExternalOAuth(
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.authIdentity) throw new UnauthorizedException('Missing auth token.');

    await this.externalOAuth.link(request.authIdentity, requireTicket(body));

    return this.authService.getOrCreateUser(request.authIdentity);
  }
}

function requireExternalProvider(value: string) {
  const provider = parseExternalOAuthProvider(value);

  if (!provider) throw new BadRequestException('Unsupported external auth provider.');

  return provider;
}

function requireDiscordMobileAuthorization(body: Record<string, unknown>) {
  const code = body.code;
  const codeVerifier = body.codeVerifier;
  const redirectUri = body.redirectUri;

  if (typeof code !== 'string' || !code || code.length > 2048) {
    throw new BadRequestException('Missing Discord authorization code.');
  }
  if (
    typeof codeVerifier !== 'string'
    || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)
  ) {
    throw new BadRequestException('Invalid Discord PKCE verifier.');
  }
  if (typeof redirectUri !== 'string' || !redirectUri || redirectUri.length > 256) {
    throw new BadRequestException('Missing Discord redirect URI.');
  }

  return { code, codeVerifier, redirectUri };
}

function requireTicket(body: Record<string, unknown>) {
  if (typeof body.ticket !== 'string' || body.ticket.length === 0 || body.ticket.length > 256) {
    throw new BadRequestException('A valid OAuth ticket is required.');
  }

  return body.ticket;
}

function requireMicrosoftIdToken(body: Record<string, unknown>) {
  if (typeof body.idToken !== 'string' || body.idToken.length === 0 || body.idToken.length > 16_384) {
    throw new BadRequestException('A valid Microsoft ID token is required.');
  }

  return body.idToken;
}
