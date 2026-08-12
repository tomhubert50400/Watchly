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
    if (request.method === 'OPTIONS' || request.path.replace(/\/+$/, '') === '/health') {
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
