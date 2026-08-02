import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const requestIdHeader = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const supplied = request.header(requestIdHeader);
    const requestId =
      supplied && /^[a-zA-Z0-9._-]{1,128}$/.test(supplied) ? supplied : randomUUID();
    (request as Request & { requestId?: string }).requestId = requestId;
    response.locals.requestId = requestId;
    response.setHeader(requestIdHeader, requestId);
    next();
  }
}
