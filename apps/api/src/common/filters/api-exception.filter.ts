import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { ApiError } from '@template/contracts';
import type { Response } from 'express';

const statusCodes: Partial<Record<number, string>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const rawMessage =
      typeof raw === 'string'
        ? raw
        : typeof raw === 'object' && raw && 'message' in raw
          ? raw.message
          : undefined;
    const stableMessage =
      typeof rawMessage === 'string' && /^[A-Z][A-Z0-9_]+$/.test(rawMessage)
        ? rawMessage
        : undefined;
    const details = Array.isArray(rawMessage) ? rawMessage : undefined;
    const body: ApiError & { requestId?: string } = {
      code: stableMessage ?? statusCodes[status] ?? 'INTERNAL_ERROR',
      message:
        status >= 500 ? '服务暂时不可用' : stableMessage ? '请求未能完成' : '请求参数或状态不正确',
      ...(details ? { details } : {}),
      ...(typeof response.locals.requestId === 'string'
        ? { requestId: response.locals.requestId }
        : {}),
    };
    response.status(status).json(body);
  }
}
