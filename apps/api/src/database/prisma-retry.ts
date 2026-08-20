type PrismaPoolErrorEmitter = {
  on(event: 'error', listener: (error: Error) => void): unknown;
};

export function registerPrismaPoolErrorHandler(
  pool: PrismaPoolErrorEmitter,
  onError: (error: Error) => void,
) {
  pool.on('error', onError);
}

export function isPrismaConnectionError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const prismaError = error as {
    code?: string;
    message?: string;
    meta?: {
      driverAdapterError?: {
        cause?: {
          kind?: string;
          originalCode?: string;
        };
      };
    };
  };
  const message = prismaError.message ?? '';
  const driverCause = prismaError.meta?.driverAdapterError?.cause;

  return (
    prismaError.code === 'ECONNREFUSED' ||
    prismaError.code === 'P1017' ||
    driverCause?.originalCode === '08P01' ||
    ((prismaError.code === '34000' || driverCause?.originalCode === '34000') &&
      message.includes('portal "" does not exist')) ||
    ((prismaError.code === 'P1017' || prismaError.code === 'P2010') &&
      driverCause?.kind === 'ConnectionClosed') ||
    message.includes('Server has closed the connection') ||
    message.includes('Cannot use a pool after calling end on the pool') ||
    message.includes('Connection terminated unexpectedly') ||
    (message.includes('bind message supplies') && message.includes('prepared statement')) ||
    message.includes('ECONNREFUSED') ||
    message.includes('ECONNRESET')
  );
}
