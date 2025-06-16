import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import { visualizer } from 'rollup-plugin-visualizer'
import terser from '@rollup/plugin-terser'

export default {
  input: 'src/viewer.js',
  output: {
    file: 'dist/viewer.js',
    format: 'esm',
    inlineDynamicImports: true  // 内联动态导入
  },
  plugins: [
    resolve(),
    commonjs(),
    babel({ babelHelpers: 'bundled' }),
    visualizer(),
    terser()
  ],
  external: ['vue'] // 添加其他你不想打包的外部依赖
};