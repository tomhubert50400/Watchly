type EnvironmentRequest = {
  get(name: string): string | undefined;
  method: string;
  path: string;
};

type EnvironmentResponse = {
  status(code: number): {
    json(body: { message: string; statusCode: number }): unknown;
  };
};

type NextFunction = () => void;

export function createEnvironmentIsolationMiddleware(expectedEnvironment: string) {
  return (request: EnvironmentRequest, response: EnvironmentResponse, next: NextFunction) => {
    const normalizedPath = request.path.replace(/\/+$/, '');

    if (
      request.method === 'OPTIONS'
      || normalizedPath === '/health'
      || normalizedPath === '/auth/oauth/discord/callback'
    ) {
      next();
      return;
    }

    if (request.get('x-watchly-environment') === expectedEnvironment) {
      next();
      return;
    }

    response.status(409).json({
      message: 'Client environment does not match API environment.',
      statusCode: 409,
    });
  };
}
