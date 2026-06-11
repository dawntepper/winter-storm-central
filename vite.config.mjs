import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Netlify edge geo is unavailable in plain `vite` dev; stub /api/geo so the
// catch-all /api proxy does not ECONNREFUSED against netlify dev on :8888.
const devGeoApi = () => ({
  name: 'dev-geo-api',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split('?')[0]
      if (path !== '/api/geo') return next()
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ city: null, region: null, regionName: null, country: null }))
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devGeoApi()],
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
