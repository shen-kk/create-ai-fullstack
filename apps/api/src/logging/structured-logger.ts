import { Injectable, type LoggerService } from '@nestjs/common';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  [key: string]: unknown;
}

export function createLogEntry(
  level: LogLevel,
  message: unknown,
  context?: string,
  metadata: Record<string, unknown> = {},
): StructuredLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message: message instanceof Error ? message.message : String(message),
    ...(context ? { context } : {}),
    ...metadata,
  };
}

@Injectable()
export class StructuredLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }
  fatal(message: unknown, context?: string): void {
    this.write('error', message, context);
  }
  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace ? { trace } : {});
  }
  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  write(
    level: LogLevel,
    message: unknown,
    context?: string,
    metadata: Record<string, unknown> = {},
  ): void {
    const line = `${JSON.stringify(createLogEntry(level, message, context, metadata))}\n`;
    if (level === 'error') process.stderr.write(line);
    else process.stdout.write(line);
  }
}
