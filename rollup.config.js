import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import strip from '@rollup/plugin-strip';
import replace from '@rollup/plugin-replace';

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

export default [
  {
    input: 'src/install.ts',
    output: {
      file: 'dist/install.js',
      format: 'cjs',
    },
    plugins: nodePlugins,
  },
  {
    input: 'src/uninstall.ts',
    output: {
      file: 'dist/uninstall.js',
      format: 'cjs',
    },
    plugins: nodePlugins,
  },
  {
    input: 'src/extension/background.ts',
    output: {
      file: 'dist/extension/background.js',
      format: 'iife',
      name: 'cmcBackground',
    },
    plugins: browserPlugins,
  },
  {
    input: 'src/extension/content.ts',
    output: {
      file: 'dist/extension/content.js',
      format: 'iife',
      name: 'cmcContent',
    },
    plugins: browserPlugins,
  },
  {
    input: 'src/host/main.ts',
    output: {
      file: 'dist/host/main.js',
      format: 'cjs',
    },
    plugins: nodePlugins,
  },
  {
    input: 'src/cli/support.ts',
    output: {
      file: 'dist/cli/support.js',
      format: 'cjs',
    },
    plugins: nodePlugins,
  },
  {
    input: 'src/cli/main.ts',
    output: {
      file: 'dist/cli/main.js',
      format: 'cjs',
    },
    plugins: nodePlugins,
  },
];
