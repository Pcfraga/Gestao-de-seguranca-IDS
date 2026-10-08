import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { env } from 'node:process'

const legacyFaviconRedirect: Plugin = {
  name: 'ids-legacy-favicon-redirect',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url === '/favicon.ico') {
        response.statusCode = 302
        response.setHeader('Location', '/ids-mark.svg')
        response.end()
        return
      }

      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), legacyFaviconRedirect],
  server: {
    proxy: {
      '/api': {
        target: env.IDS_API_PROXY_TARGET ?? 'http://localhost:5141',
        changeOrigin: true,
      },
    },
  },
})
