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
      // One file per Phosphor icon instead of the whole 1,500-icon barrel.
      './babel/phosphor-per-icon',
      // Reanimated MUST be last
      'react-native-reanimated/plugin',
    ],
  };
};
