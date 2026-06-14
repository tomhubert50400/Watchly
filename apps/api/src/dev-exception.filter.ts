import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class DevExceptionFilter implements ExceptionFilter {
  constructor(private readonly exposeErrorMessages: boolean) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

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

    const message =
      this.exposeErrorMessages && exception instanceof Error
        ? exception.message
        : 'Internal server error';

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
