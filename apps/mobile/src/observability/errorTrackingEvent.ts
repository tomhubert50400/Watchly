export type MobileErrorEvent = {
  request?: {
    cookies?: unknown;
    data?: unknown;
    headers?: unknown;
    query_string?: unknown;
    url?: string;
  };
  user?: unknown;
};

export function sanitizeMobileErrorEvent<T extends MobileErrorEvent>(event: T): T {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.query_string;

    if (event.request.url) {
      event.request.url = event.request.url.split('?', 1)[0];
    }
  }

  delete event.user;
  return event;
}
