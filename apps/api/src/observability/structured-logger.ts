import { LoggerService } from '@nestjs/common';
import { getRequestId } from './request-context';

export type StructuredLogRecord = {
  level: 'debug' | 'error' | 'info' | 'warn';
  message: string;
  [key: string]: unknown;
};

type LogSink = (line: string, level: StructuredLogRecord['level']) => void;

export class StructuredLogger implements LoggerService {
  constructor(
    private readonly environment: string,
    private readonly sink: LogSink = writeLine,
  ) {}

  log(message: unknown, ...optionalParams: unknown[]) {
    this.write({
      context: getContext(optionalParams),
      level: 'info',
      message: toSafeMessage(message),
    });
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write({
      context: getContext(optionalParams),
      level: 'error',
      message: toSafeMessage(message),
    });
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write({
      context: getContext(optionalParams),
      level: 'warn',
      message: toSafeMessage(message),
    });
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write({
      context: getContext(optionalParams),
      level: 'debug',
      message: toSafeMessage(message),
    });
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.debug(message, ...optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    this.error(message, ...optionalParams);
  }

  write(record: StructuredLogRecord) {
    const requestId = getRequestId();
    const normalized = removeUndefined({
      timestamp: new Date().toISOString(),
      environment: this.environment,
      service: 'api',
      requestId,
      ...record,
      message: redactSensitiveText(record.message),
    });

    this.sink(JSON.stringify(normalized), record.level);
  }
}

export function redactSensitiveText(value: string) {
  return value
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi, '$1[redacted]@')
    .replace(/\b(password|secret|token|api[_-]?key)=([^\s&]+)/gi, '$1=[redacted]')
    .slice(0, 1000);
}

function toSafeMessage(message: unknown) {
  if (typeof message === 'string') {
    return message;
  }

  if (message instanceof Error) {
    return `${message.name}: ${message.message}`;
  }

  if (typeof message === 'number' || typeof message === 'boolean' || typeof message === 'bigint') {
    return String(message);
  }

  return message && typeof message === 'object'
    ? `[${message.constructor?.name || 'Object'}]`
    : String(message);
}

function getContext(optionalParams: unknown[]) {
  const candidate = optionalParams.at(-1);
  return typeof candidate === 'string' ? redactSensitiveText(candidate) : undefined;
}

function removeUndefined(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function writeLine(line: string, level: StructuredLogRecord['level']) {
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}
