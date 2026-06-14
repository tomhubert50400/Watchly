export async function withPrismaConnectionRetry<T>(
  operation: () => Promise<T>,
  resetConnection?: () => Promise<void>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isClosedConnectionError(error)) {
        throw error;
      }

      lastError = error;

      if (resetConnection) {
        await resetConnection();
      }

      await delay((attempt + 1) * 150);
    }
  }

  throw lastError;
}

function isClosedConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('Server has closed the connection') ||
    error.message.includes('Connection terminated unexpectedly') ||
    error.message.includes('ECONNRESET')
  );
}

function delay(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
