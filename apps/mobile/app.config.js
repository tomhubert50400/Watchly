const allowedVariants = new Set(['development', 'staging', 'production']);
const discordApplicationId = '1539925787333890090';

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT?.trim() || 'development';
  const publicEnvironment = process.env.EXPO_PUBLIC_APP_ENV?.trim() || variant;

  if (!allowedVariants.has(variant)) {
    throw new Error(`Invalid APP_VARIANT: ${variant}.`);
  }

  if (publicEnvironment !== variant) {
    throw new Error(
      `APP_VARIANT (${variant}) must match EXPO_PUBLIC_APP_ENV (${publicEnvironment}).`,
    );
  }

  const applicationId = getApplicationId(variant, config);
  const isDevelopment = variant === 'development';
  const usesLocalNetworking = isDevelopment || process.env.WATCHLY_DEV_CLIENT === 'true';

  return {
    ...config,
    name: variant === 'staging' ? 'Watchly Staging' : config.name,
    scheme: getApplicationSchemes(
      config.scheme,
      config.ios?.bundleIdentifier,
      applicationId,
      discordApplicationId,
    ),
    ios: {
      ...config.ios,
      bundleIdentifier: applicationId,
      infoPlist: usesLocalNetworking
        ? withDiscordQueries(config.ios?.infoPlist)
        : withoutLocalNetworkEntitlements(withDiscordQueries(config.ios?.infoPlist)),
    },
    android: {
      ...config.android,
      package: applicationId,
    },
    extra: {
      ...config.extra,
      appEnvironment: variant,
    },
  };
};

function getApplicationSchemes(
  configuredSchemes,
  configuredApplicationId,
  applicationId,
  discordClientId,
) {
  const schemes = Array.isArray(configuredSchemes)
    ? configuredSchemes
    : configuredSchemes
      ? [configuredSchemes]
      : [];

  return [...new Set([
    ...schemes.filter((scheme) => (
      scheme !== configuredApplicationId && scheme !== `msauth.${configuredApplicationId}`
    )),
    applicationId,
    `msauth.${applicationId}`,
    `discord-${discordClientId}`,
  ])];
}

function withDiscordQueries(infoPlist = {}) {
  const querySchemes = Array.isArray(infoPlist.LSApplicationQueriesSchemes)
    ? infoPlist.LSApplicationQueriesSchemes
    : [];

  return {
    ...infoPlist,
    LSApplicationQueriesSchemes: [...new Set([...querySchemes, 'discord'])],
  };
}

function getApplicationId(variant, config) {
  if (variant === 'development') {
    return config.ios?.bundleIdentifier;
  }

  if (variant === 'staging') {
    return 'com.tom.tvapp.staging';
  }

  const productionApplicationId = process.env.WATCHLY_PRODUCTION_APPLICATION_ID?.trim();
  if (!productionApplicationId) {
    throw new Error('WATCHLY_PRODUCTION_APPLICATION_ID is required for production builds.');
  }

  return productionApplicationId;
}

function withoutLocalNetworkEntitlements(infoPlist = {}) {
  const {
    NSAppTransportSecurity,
    NSLocalNetworkUsageDescription: _localNetworkUsageDescription,
    ...remainingInfoPlist
  } = infoPlist;
  const {
    NSAllowsLocalNetworking: _allowsLocalNetworking,
    ...remainingTransportSecurity
  } = NSAppTransportSecurity || {};

  return Object.keys(remainingTransportSecurity).length > 0
    ? { ...remainingInfoPlist, NSAppTransportSecurity: remainingTransportSecurity }
    : remainingInfoPlist;
}
