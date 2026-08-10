import {
  BadRequestException,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ImportSourceValue } from './import-file.parser';
import { ImportUpload, ImportsService, MAX_IMPORT_FILE_BYTES } from './imports.service';

@Controller('imports')
@UseGuards(AuthGuard)
export class ImportsController {
  constructor(@Inject(ImportsService) private readonly imports: ImportsService) {}

  @Post(':source/preview')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_IMPORT_FILE_BYTES },
  }))
  preview(
    @Req() request: AuthenticatedRequest,
    @Param('source') source: string,
    @UploadedFile() file: ImportUpload,
  ) {
    return this.imports.preview(getIdentity(request), parseSource(source), file);
  }

  @Post(':importId/confirm')
  confirm(
    @Req() request: AuthenticatedRequest,
    @Param('importId') importId: string,
  ) {
    return this.imports.confirm(getIdentity(request), importId);
  }
}

function parseSource(source: string): ImportSourceValue {
  if (source !== 'letterboxd' && source !== 'imdb') {
    throw new BadRequestException('Supported import sources are Letterboxd and IMDb.');
  }

  return source;
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}
