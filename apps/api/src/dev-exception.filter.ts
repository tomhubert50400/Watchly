import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { getRequestPath } from './observability/request-observability.middleware';
import { getRequestId } from './observability/request-context';
import { redactSensitiveText, StructuredLogger } from './observability/structured-logger';
import { captureApiException } from './observability/error-tracking';

@Catch()
export class DevExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly exposeErrorMessages: boolean,
    private readonly logger?: StructuredLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<{ method?: string; originalUrl?: string; url?: string }>();
    const response = http.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logException(exception, request, status);
      }

      response.status(status).json(
        typeof body === 'string'
          ? {
              message: body,
              statusCode: status,
            }
          : body,
      );
      return;
    }

    this.logException(exception, request, HttpStatus.INTERNAL_SERVER_ERROR);

    const message =
      this.exposeErrorMessages && exception instanceof Error
        ? exception.message
        : 'Internal server error';

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }

  private logException(
    exception: unknown,
    request: { method?: string; originalUrl?: string; url?: string },
    statusCode: number,
  ) {
    const errorName = exception instanceof Error ? exception.name : 'UnknownError';
    const errorMessage = exception instanceof Error ? exception.message : 'Unknown thrown value';
    const method = request.method ?? 'UNKNOWN';
    const path = getRequestPath(request);
    const requestId = getRequestId();

    captureApiException(exception, {
      method,
      path,
      requestId,
      statusCode,
    });

    this.logger?.write({
      errorMessage: redactSensitiveText(errorMessage),
      errorName,
      event: 'http.exception',
      level: 'error',
      message: 'Unhandled request exception',
      method,
      path,
      requestId,
      statusCode,
    });
  }
}
