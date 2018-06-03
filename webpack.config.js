const path = require('path')

module.exports = {
  entry: {
    main: path.resolve(__dirname, 'src', 'main.ts'),
    renderer: path.resolve(__dirname, 'src', 'renderer.ts'),
    puzzle_list: path.resolve(__dirname, 'src', 'puzzle-list.ts'),
  },
  target: 'electron-main',
  node: {
    __dirname: false, // https://github.com/webpack/webpack/issues/1599
  },
  devtool: 'eval-source-map',
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  }
}
