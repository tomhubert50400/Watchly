export type DevAuthEnvironment = {
  emulatorHost?: string;
  email?: string;
  password?: string;
};

export type DevAuthConfig = {
  emulatorUrl: string;
  email: string;
  password: string;
};

export function resolveDevAuthConfig(
  isDevelopment: boolean,
  environment: DevAuthEnvironment,
): DevAuthConfig | null {
  const { emulatorHost, email, password } = environment;

  if (!isDevelopment || !emulatorHost || !email || !password) {
    return null;
  }

  return {
    emulatorUrl: /^https?:\/\//.test(emulatorHost) ? emulatorHost : `http://${emulatorHost}`,
    email,
    password,
  };
}
