import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AdminRequest, AuthenticatedAdmin } from '../auth/auth.types';
import {
  ADMIN_REPORT_REASONS,
  ADMIN_REPORT_STATUSES,
  ADMIN_REPORT_TARGET_TYPES,
  ListReportsQuery,
  UpdateReportStatusDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get('session')
  session(@Req() request: AdminRequest) {
    const identity = getAdminIdentity(request);

    return {
      email: identity.email,
      mfaVerified: true,
      secondFactor: identity.secondFactor,
    };
  }

  @Get('reports')
  listReports(
    @Req() request: AdminRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('query') query?: string,
    @Query('reason') reason?: string,
    @Query('status') status?: string,
    @Query('targetType') targetType?: string,
  ) {
    return this.admin.listReports(getAdminIdentity(request), {
      page: parseBoundedInteger(page, 1, 1, Number.MAX_SAFE_INTEGER, 'page'),
      pageSize: parseBoundedInteger(pageSize, 25, 1, 100, 'pageSize'),
      query: parseSearchQuery(query),
      reason: parseOptionalValue(reason, ADMIN_REPORT_REASONS, 'reason'),
      status: parseOptionalValue(status, ADMIN_REPORT_STATUSES, 'status'),
      targetType: parseOptionalValue(targetType, ADMIN_REPORT_TARGET_TYPES, 'targetType'),
    } satisfies ListReportsQuery);
  }

  @Get('reports/:reportId')
  report(
    @Req() request: AdminRequest,
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ) {
    return this.admin.getReport(getAdminIdentity(request), reportId);
  }

  @Patch('reports/:reportId')
  updateReport(
    @Req() request: AdminRequest,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() body: UpdateReportStatusDto,
  ) {
    return this.admin.updateReportStatus(getAdminIdentity(request), reportId, body);
  }
}

function getAdminIdentity(request: AdminRequest): AuthenticatedAdmin {
  if (!request.adminIdentity) {
    throw new UnauthorizedException('Missing admin identity.');
  }

  return request.adminIdentity;
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  field: string,
) {
  if (value === undefined) return fallback;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new BadRequestException(`${field} is invalid.`);
  }

  return parsed;
}

function parseSearchQuery(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) return undefined;

  if (normalized.length > 100) {
    throw new BadRequestException('query is too long.');
  }

  return normalized;
}

function parseOptionalValue<const T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  field: string,
): T[number] | undefined {
  if (value === undefined || value === '') return undefined;

  if (!allowed.includes(value)) {
    throw new BadRequestException(`${field} is invalid.`);
  }

  return value as T[number];
}
