module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@shared':       '../../packages/shared/src',
            '@features':     './src/features',
            '@navigation':   './src/navigation',
            '@mobile/shared':'./src/shared',
            '@theme':        './src/theme',
          },
          extensions: ['.native.ts', '.native.tsx', '.native.js', '.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      // Reanimated MUST be last
      'react-native-reanimated/plugin',
    ],
  };
};
