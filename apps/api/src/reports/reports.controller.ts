import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { SubmitReportDto } from './reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Post()
  async submit(@Req() request: AuthenticatedRequest, @Body() body: SubmitReportDto) {
    if (!request.authIdentity) {
      throw new UnauthorizedException('Missing auth token.');
    }

    return this.reports.submitReport(request.authIdentity, body);
  }
}
