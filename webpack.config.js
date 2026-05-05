const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const WebpackObfuscator = require('webpack-obfuscator');

const SRC  = path.resolve(__dirname, 'src');
const DIST = path.resolve(__dirname, 'dist');

const obfuscatorOptions = {
  // --- structure ---
  compact: true,
  simplify: true,
  renameGlobals: false,

  // --- control flow ---
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,

  // --- dead code ---
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,

  // NOTE: selfDefending, debugProtection, and disableConsoleOutput are intentionally
  // excluded — they use eval/Function() which Chrome Extension MV3 CSP blocks,
  // causing the popup to freeze on load.

  // --- identifier mangling ---
  identifierNamesGenerator: 'hexadecimal',
  identifiersDictionary: [],
  identifiersPrefix: '',

  // --- string array (core obfuscation layer) ---
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 3,
  stringArrayWrappersType: 'function',

  // --- string splitting ---
  splitStrings: true,
  splitStringsChunkLength: 5,

  // --- number / key obfuscation ---
  numbersToExpressions: true,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,

  log: false,
};

module.exports = {
  // content + popup only — background is copied raw (service workers can't use webpack runtime)
  entry: {
    content: path.join(SRC, 'content.js'),
    popup: path.join(SRC, 'popup.js'),
  },
  output: {
    path: DIST,
    filename: '[name].js',
    clean: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'manifest.json'), to: DIST },
        { from: path.join(SRC, 'background.js'), to: DIST },  // copied raw, not bundled
        { from: path.join(SRC, 'popup.html'), to: DIST },
        { from: path.join(SRC, 'popup.css'), to: DIST },
        { from: path.join(SRC, 'styles.css'), to: DIST },
        { from: path.resolve(__dirname, 'icons'), to: path.join(DIST, 'icons') },
      ],
    }),
    new WebpackObfuscator(obfuscatorOptions),
  ],
  optimization: {
    minimize: false,
  },
};
