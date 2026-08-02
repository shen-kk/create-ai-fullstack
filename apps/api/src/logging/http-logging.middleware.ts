import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { AuthUser } from '@template/contracts';
import type { NextFunction, Request, Response } from 'express';
import { StructuredLogger } from './structured-logger.js';

type LoggedRequest = Request & { requestId?: string; user?: AuthUser };

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLogger) {}
  use(request: LoggedRequest, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.logger.write(
        response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'info',
        'http.request.completed',
        'HTTP',
        {
          requestId: request.requestId ?? response.locals.requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          ...(request.user?.id ? { actorId: request.user.id } : {}),
        },
      );
    });
    next();
  }
}
