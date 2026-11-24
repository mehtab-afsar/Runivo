/**
 * Two iOS values other plugins set to something the App Store build must not carry.
 *
 * 1. Orientation. Expo maps `orientation: 'portrait'` to Portrait AND PortraitUpsideDown,
 *    so the phone could rotate upside down in an app whose layouts are portrait-only.
 *    The supported list is set to Portrait alone (iPhone only: supportsTablet is false).
 *
 * 2. aps-environment (push). expo-widgets writes 'development' unconditionally, after
 *    expo-notifications has set its `mode`, so the notifications plugin option has no
 *    effect. App Store builds say 'production'. EAS sets EAS_BUILD_PROFILE on the build
 *    server; a local prebuild stays on 'development' unless you export
 *    EAS_BUILD_PROFILE=production.
 *
 * Listed LAST in app.config.ts so it runs on the finished values.
 */
const { withInfoPlist, withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withIosReleaseConfig(config) {
  config = withInfoPlist(config, cfg => {
    cfg.modResults.UISupportedInterfaceOrientations = ['UIInterfaceOrientationPortrait'];
    delete cfg.modResults['UISupportedInterfaceOrientations~ipad'];
    return cfg;
  });
  return withEntitlementsPlist(config, cfg => {
    cfg.modResults['aps-environment'] =
      process.env.EAS_BUILD_PROFILE === 'production' ? 'production' : 'development';
    return cfg;
  });
};
