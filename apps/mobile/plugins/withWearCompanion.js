/**
 * L4: adds the Runivo Wear OS app (targets/wear) to the Android project as a
 * ':wear' Gradle module. Used only when RUNIVO_WEAR=1 (see app.config.ts), so
 * a phone-only Android build never depends on it.
 *
 * Build the watch APK:  cd android && ./gradlew :wear:assembleRelease
 * Publish it to the same Play listing as the phone app (Wear OS form factor).
 */
const { withSettingsGradle, withProjectBuildGradle } = require('expo/config-plugins');

const SETTINGS = `
// Runivo Wear OS app (plugins/withWearCompanion.js)
include ':wear'
project(':wear').projectDir = new File(rootDir, '../targets/wear')
`;

module.exports = function withWearCompanion(config) {
  config = withSettingsGradle(config, cfg => {
    if (!cfg.modResults.contents.includes("include ':wear'")) cfg.modResults.contents += SETTINGS;
    return cfg;
  });
  config = withProjectBuildGradle(config, cfg => {
    const id = config.android?.package ?? 'com.mehtabafsar.runivo';
    const line = `ext.wearApplicationId = '${id}'`;
    let s = cfg.modResults.contents;
    if (!s.includes('wearApplicationId')) s += `\n// Runivo Wear OS app id (same as the phone app)\n${line}\n`;
    // The wear module needs the Compose compiler plugin matching React Native's Kotlin (2.1.20).
    if (!s.includes('org.jetbrains.kotlin.plugin.compose')) {
      s = s.replace(/(dependencies\s*\{)/, `$1\n    classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:2.1.20")`);
    }
    cfg.modResults.contents = s;
    return cfg;
  });
  return config;
};
