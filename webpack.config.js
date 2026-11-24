require('dotenv').config();
const path    = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

const SRC  = path.resolve(__dirname, 'src');
const DIST = path.resolve(__dirname, 'dist');

// NOTE: No obfuscation. Chrome Web Store policy rejects obfuscated code
// (minification is fine, obfuscation is not).

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    // content, popup, and background are all bundled so DefinePlugin can
    // substitute process.env.* values at build time.
    entry: {
      content:    path.join(SRC, 'content.js'),
      popup:      path.join(SRC, 'popup.js'),
      background: path.join(SRC, 'background.js'),
    },
    output: {
      path: DIST,
      filename: '[name].js',
      clean: true,
    },
    plugins: [
      // Substitute .env values at build time — no runtime 'process' object needed.
      new webpack.DefinePlugin({
        'process.env.SUPABASE_URL':      JSON.stringify(process.env.SUPABASE_URL),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
        'process.env.API_BASE':          JSON.stringify(process.env.API_BASE),
        'process.env.PAYMENT_LINK':      JSON.stringify(process.env.PAYMENT_LINK),
      }),
      new CopyPlugin({
        patterns: [
          { from: path.resolve(__dirname, 'manifest.json'), to: DIST },
          // background.js is now bundled via entry above — no raw copy needed
          { from: path.join(SRC, 'popup.html'), to: DIST },
          { from: path.join(SRC, 'popup.css'), to: DIST },
          { from: path.join(SRC, 'styles.css'), to: DIST },
          { from: path.resolve(__dirname, 'icons'), to: path.join(DIST, 'icons') },
        ],
      }),
    ],
    optimization: {
      minimize: !isDev,
    },
  };
};
