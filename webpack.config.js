const path = require('path');
//var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
//  entry: './src/safenetwork-solid.js',
  entry: './src/index.js',
/*
  entry: {
    app: [
    './src/node-modules.js',
    ],
  },
*/
module: {
  rules: [
    {
      test: /\.js$/,
      loader: 'babel-loader',
      exclude: /node_modules/
    }
  ]
},
/*
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'to-string-loader',
          'css-loader'
        ]
      },
      {
        test: /\.html$/,
        use: [
          'to-string-loader',
          'html-loader'
        ]
      }
    ]
  },
*/
/*based on rdflib:*/
  output: {
//    path: path.join(__dirname, '/dist/'),
    path: path.resolve(__dirname, 'dist'),
    filename: 'solid-safenetwork.js',
    library: 'SafenetworkLDP',
    libraryTarget: 'umd'
  },
/*
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'solid-safenetwork.js',
  },
  context: path.join(__dirname, '.'),
*/
/*  plugins: [
      new CopyWebpackPlugin([
          { from: 'src' }
      ])
  ],
  */
  devtool: '#source-map', // #eval-source-map doesn't emit a map!?
  target: 'web', // default!
};
