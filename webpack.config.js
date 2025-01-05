const path = require('path')

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  entry: process.env.NODE_ENV === 'test'
    ? {
        extension: './src/extension.js',
        test: './test/index.js'
      }
    : {
        extension: './src/extension.js'
      },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode',
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
  mode: process.env.NODE_ENV === 'test' ? 'development' : 'production',
  devtool: process.env.NODE_ENV === 'test' ? 'source-map' : false,
  optimization: {
    minimize: process.env.NODE_ENV !== 'test' // Minimize unless testing
  }
}

module.exports = config
