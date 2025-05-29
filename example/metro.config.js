const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const root = path.resolve(__dirname, '..');
const appDir = __dirname;

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 */
const config = {
  watchFolders: [root, appDir],
  
  resolver: {
    extraNodeModules: {
      'react-native-swipe-predictor': root,
    },
    nodeModulesPaths: [
      path.resolve(appDir, 'node_modules'),
      path.resolve(root, 'node_modules'),
    ],
  },
  
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);