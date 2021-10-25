'use strict';

const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const PermissionsOutputPlugin = require('webpack-permissions-plugin');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  entry: './src/extension.js', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
  },
  module: {
    rules: [
      {
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        // clipboardy looks for fallback executables in <extension folder>/fallbacks/..
        // TODO: Better way to get this folder in the correct location in a packaged extension?
        { from: "node_modules/clipboardy/fallbacks", to: "../fallbacks" }
      ],
    }),
    new PermissionsOutputPlugin({
      buildFolders: [
        {
          path: path.resolve(__dirname, 'fallbacks/'),
          fileMode: '555',
          dirMode: '555'
        }
      ]
    })
  ]
};
module.exports = config;
