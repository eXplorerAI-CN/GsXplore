import { defineConfig } from 'vite'
import path from 'node:path'
import vue from '@vitejs/plugin-vue'
// import mkcert from 'vite-plugin-mkcert'
import fs from 'fs';
import UnoCSS from 'unocss/vite'

// https://vitejs.dev/config/
export default defineConfig({

  server: {
    port: 5173, 
    host: 'localhost', // 本机ip，方便手机调试
    // https: true,
    // https: {
    //   key: fs.readFileSync('../cert/key.pem'),
    //   cert: fs.readFileSync('../cert/cert.pem'),
    // },
  },
  resolve: {
    alias: {
      '~/': `${path.resolve(__dirname, 'src')}/`,
      '@/': `${path.resolve(__dirname, 'src')}/`,
    },
  },
  plugins: [vue(), UnoCSS()],
  assetsInclude: ['**/*.ply']  // 包含所有 .ply 文件作为静态资源
})
