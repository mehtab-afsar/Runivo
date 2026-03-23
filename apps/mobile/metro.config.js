const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Explicitly pin projectRoot so watchFolders doesn't cause Expo to
// auto-detect the monorepo root as projectRoot (which shifts all bundle paths).
config.projectRoot = projectRoot;

// Watch the shared package
config.watchFolders = [workspaceRoot];

// When watchFolders includes the workspace root, Metro shifts all bundle URLs
// to be relative to the workspace root (e.g. /apps/mobile/index.bundle).
// The native app always requests /index.bundle, so we rewrite it here.
const appRelPath = path.relative(workspaceRoot, path.join(projectRoot, 'index'));
config.server = {
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Rewrite /index.bundle → /apps/mobile/index.bundle
      if (req.url && /^\/(index\.bundle|index\.map)(\?|$)/.test(req.url)) {
        req.url = req.url.replace(/^\/index/, `/${appRelPath}`);
      }
      return middleware(req, res, next);
    };
  },
};

// Use package.json "exports" field so Metro picks ESM .mjs for supabase-js
// (avoids CJS circular getter → Hermes stack overflow)
config.resolver.unstable_enablePackageExports = true;

// Resolve shared package correctly
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Native files take priority over web files; cjs/mjs needed for supabase-js dist
config.resolver.sourceExts = [
  'native.ts',
  'native.tsx',
  'native.js',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'cjs',
  'mjs',
];

// Module aliases
config.resolver.extraNodeModules = {
  // Shared business logic
  '@shared': path.resolve(workspaceRoot, 'packages/shared/src'),
  // Mobile-app-internal aliases (used throughout apps/mobile/src/)
  '@features':     path.resolve(projectRoot, 'src/features'),
  '@mobile/shared': path.resolve(projectRoot, 'src/shared'),
  '@navigation':   path.resolve(projectRoot, 'src/navigation'),
  // h3-js shim: pre-installs text-encoding polyfill before h3-js loads
  // so Hermes doesn't crash on new TextDecoder("utf-16le")
  'h3-js': path.resolve(projectRoot, 'shims/h3-js.js'),
  // Force the full-featured npm buffer polyfill (supports utf-16le)
  'buffer': path.resolve(workspaceRoot, 'node_modules/buffer'),
};

module.exports = config;
