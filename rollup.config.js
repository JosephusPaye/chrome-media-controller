import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import strip from '@rollup/plugin-strip';
import replace from '@rollup/plugin-replace';
import path from 'path';

const devModeReplace = replace({
  __DEV__: process.env.BUILD !== 'production',
});

const nodePlugins = [typescript(), devModeReplace];

const browserPlugins = [
  // CommonJS plugin is necessary to expand imports inline,
  // otherwise you get require() calls in the bundle
  typescript({ module: 'CommonJS' }),
  devModeReplace,
  commonjs({ extensions: ['.js', '.ts'] }),
];

if (process.env.BUILD === 'production') {
  nodePlugins.push(
    strip({
      include: 'src/extension/*.ts',
      functions: ['console.log'],
    })
  );

  browserPlugins.push(
    strip({
      include: 'src/extension/*.ts',
      functions: ['console.log'],
    })
  );
}

const files = [
  'src/cli/main.ts',
  'src/cli/support.ts',
  'src/cli/commands/ls.ts',
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
