import { defineConfig } from 'unocss'
import presetIcons from '@unocss/preset-icons'
// 选择一个基础预设
import presetUno from '@unocss/preset-uno'  // 基础预设

export default defineConfig({
  presets: [
    presetUno(),  
    presetIcons({
      scale: 1.2,
      prefix: 'i-',
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
      // 如果你只想使用 Remix Icon，可以添加以下配置提高性能
      collections: {
        ri: () => import('@iconify-json/ri/icons.json').then(i => i.default),
        mdi: () => import('@iconify-json/mdi/icons.json').then(i => i.default),
      }
    }),
  ],
})