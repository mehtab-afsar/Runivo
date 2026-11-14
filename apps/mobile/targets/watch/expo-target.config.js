/**
 * L4: the Runivo Apple Watch companion. Added to the native project by
 * @bacons/apple-targets only when RUNIVO_WATCH=1 (see app.config.ts), so the
 * phone build is unchanged until you opt in.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'watch',
  name: 'Runivo Watch',
  bundleIdentifier: '.watchkitapp',
  deploymentTarget: '10.0',
  frameworks: ['SwiftUI', 'WatchConnectivity'],
  icon: '../../assets/icon.png',
});
