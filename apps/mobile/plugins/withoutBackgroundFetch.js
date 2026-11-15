/**
 * Removes the `fetch` iOS background mode.
 *
 * expo-task-manager's config plugin adds UIBackgroundModes `fetch` to every app
 * that installs it. Runivo registers no background-fetch task: its only task is
 * the location task (`location` mode), which TaskManager runs without `fetch`.
 * App Review (2.5.4) wants every declared background mode to be used, so an
 * unused `fetch` is a needless question. Listed AFTER expo-task-manager's plugin
 * in app.config.ts so it runs on the finished list.
 */
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withoutBackgroundFetch(config) {
  return withInfoPlist(config, cfg => {
    const modes = cfg.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) cfg.modResults.UIBackgroundModes = modes.filter(m => m !== 'fetch');
    return cfg;
  });
};
