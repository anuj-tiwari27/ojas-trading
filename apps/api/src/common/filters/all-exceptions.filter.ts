import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Normalizes every error into a consistent envelope:
 * { success: false, statusCode, message, errors?, path, timestamp }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errors: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? exception.message;
        errors = b.errors ?? undefined;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // Prisma known errors expose a `code` (e.g. P2002 unique violation)
      const code = (exception as { code?: string }).code;
      if (code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A record with these unique values already exists.';
      } else if (code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found.';
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
