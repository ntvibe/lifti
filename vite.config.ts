import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('recharts') || id.includes('/d3-')) return 'charts'
          if (id.includes('@dnd-kit')) return 'dnd'
          if (id.includes('dexie')) return 'data'
          if (id.includes('react-router')) return 'router'
          if (id.includes('zustand') || id.includes('zod')) return 'state'
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-able-icon.png'],
      manifest: {
        name: 'Lifti',
        short_name: 'Lifti',
        description: 'Strength training planner & workout tracker',
        theme_color: '#000000',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
