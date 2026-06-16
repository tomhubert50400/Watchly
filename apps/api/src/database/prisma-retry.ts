export async function withPrismaConnectionRetry<T>(
  operation: () => Promise<T>,
  resetConnection?: () => Promise<void>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isPrismaConnectionError(error)) {
        throw error;
      }

      lastError = error;

      if (resetConnection) {
        await resetConnection();
      }

      await delay((attempt + 1) * 300);
    }
  }

  throw lastError;
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
        };
      };
    };
  };
  const message = prismaError.message ?? '';

  return (
    prismaError.code === 'ECONNREFUSED' ||
    prismaError.code === 'P1017' ||
    ((prismaError.code === 'P1017' || prismaError.code === 'P2010') &&
      prismaError.meta?.driverAdapterError?.cause?.kind === 'ConnectionClosed') ||
    message.includes('Server has closed the connection') ||
    message.includes('Cannot use a pool after calling end on the pool') ||
    message.includes('Connection terminated unexpectedly') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ECONNRESET')
  );
}

function delay(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
