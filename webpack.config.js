'use strict'

const path = require('path')

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  entry: process.env.NODE_ENV === 'test'
    ? {
        extension: './src/extension.js',
        test: './test/index.js'
      }
    : {
        extension: './src/extension.js'
      },
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    mocha: 'commonjs mocha'
  },
  resolve: {
    extensions: ['.js']
  },
  module: {
    rules: [
      {
        exclude: /node_modules/
      }
    ]
  },
  devtool: 'source-map',
  optimization: {
    minimize: process.env.NODE_ENV !== 'test' // Don't minify test builds
  }
}
module.exports = config
