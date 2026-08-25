const path = require('node:path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
const unrelatedWorkspaceRoots = new Set([
  path.resolve(__dirname, '../api'),
  path.resolve(__dirname, '../web'),
]);

config.watchFolders = config.watchFolders.filter(
  (folder) => !unrelatedWorkspaceRoots.has(path.resolve(folder)),
);

module.exports = config;
