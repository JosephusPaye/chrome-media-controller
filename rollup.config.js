import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import path from 'path';

const devModeReplace = replace({
  __DEV__: process.env.BUILD !== 'production',
});

const nodePlugins = [typescript(), resolve(), devModeReplace];

const browserPlugins = [
  // CommonJS plugin is necessary to expand imports inline,
  // otherwise you get require() calls in the bundle
  typescript({ module: 'CommonJS' }),
  resolve(),
  commonjs({ extensions: ['.js', '.ts'] }),
  devModeReplace,
];

const files = [
  'src/cli/main.ts',
  'src/cli/support.ts',
  'src/cli/commands/action.ts',
  'src/cli/commands/extension.ts',
  'src/cli/commands/ls.ts',
  'src/cli/commands/seek.ts',
  'src/extension/background.ts',
  'src/extension/content.ts',
  'src/host/main.ts',
  'src/install.ts',
  'src/uninstall.ts',
];

const config = files.map((file) => {
  const isForBrowser = file.includes('/extension/');

  return {
    input: file,
    output: {
      file: file.replace('src/', 'dist/').replace('.ts', '.js'),
      format: isForBrowser ? 'iife' : 'cjs',
      name: isForBrowser ? path.basename(file, '.ts') : undefined,
    },
    plugins: isForBrowser ? browserPlugins : nodePlugins,
  };
});

export default config;
