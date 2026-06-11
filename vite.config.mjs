import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy admin + other Netlify functions when running `netlify dev` on :8888.
    // Use `netlify dev` for storm admin DB saves — `npm run dev` alone cannot serve functions.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true
      },
      '/.netlify/functions': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true
      }
    }
  }
})
