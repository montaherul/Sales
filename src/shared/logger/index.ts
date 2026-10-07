// Structured Logger
// Afaz Tobacco Sales & Stock Intelligence Platform

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface StructuredLogPayload {
  message: string;
  level: LogLevel;
  context?: string;
  userId?: string;
  territoryId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

class Logger {
  private format(level: LogLevel, message: string, context?: string, metadata?: Record<string, any>): string {
    const time = new Date().toISOString();
    const ctx = context ? ` [${context}]` : '';
    const meta = metadata ? ` ${JSON.stringify(metadata)}` : '';
    return `[${time}] [${level.toUpperCase()}]${ctx} ${message}${meta}`;
  }

  public info(message: string, context?: string, metadata?: Record<string, any>): void {
    console.log(this.format('info', message, context, metadata));
  }

  public warn(message: string, context?: string, metadata?: Record<string, any>): void {
    console.warn(this.format('warn', message, context, metadata));
  }

  public error(message: string, error?: any, context?: string, metadata?: Record<string, any>): void {
    const errorDetails = error instanceof Error ? { errorMsg: error.message, stack: error.stack } : { error };
    console.error(this.format('error', message, context, { ...metadata, ...errorDetails }));
  }

  public debug(message: string, context?: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.format('debug', message, context, metadata));
    }
  }
}

export const logger = new Logger();
